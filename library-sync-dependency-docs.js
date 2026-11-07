import { Log } from '../.codex/utils/logger.js';

const LIBRARY_SOURCE_FOLDER = '.codex/library';
const TARGET_DOCUMENT_PATH = '.codex/library/library.md';
const MARKER_BEGIN = '<!-- BEGIN GENERATED LIBRARY DEPENDENCY TABLE -->';
const MARKER_END = '<!-- END GENERATED LIBRARY DEPENDENCY TABLE -->';

const IMPORT_STATEMENT_PATTERN = /import\s+[^;]*?;/gs;
const STATIC_IMPORT_CAPTURE_PATTERN = /^import\s+(?:[\w*\s{},$]+\s+from\s+)?["']([^"']+)["']\s*;?$/;
const DYNAMIC_IMPORT_PATTERN = /import\s*\(\s*["']([^"']+)["']/g;
const RE_EXPORT_PATTERN = /export\s+[^;]*?\bfrom\s+["'][^"']+["']\s*;?/gs;

export function buildInvokeCommand(app) {
	return {
		name: 'Sync Library Dependency Documentation',
		id: 'library-sync-dependency-docs',
		async callback() {
			let phase = 'file enumeration';
			try {
				const files = collectLibraryJsFiles(app);

				phase = 'reading and parsing';
				const graph = await buildDependencyGraph(app, files);

				phase = 'rendering';
				const generatedAt = new Date().toISOString();
				const renderedBlock = renderDependencyBlock(graph, files.length, generatedAt);

				phase = 'marker validation';
				const targetFile = app.vault.getAbstractFileByPath(TARGET_DOCUMENT_PATH);
				if (!targetFile) {
					const error = new Error(`Target document not found at "${ TARGET_DOCUMENT_PATH }".`);
					Log.error(
						'library-sync-dependency-docs',
						error.message,
						error
					);
					throw error;
				}
				const documentText = await app.vault.read(targetFile);
				const updatedText = spliceGeneratedBlock(documentText, renderedBlock);

				phase = 'document writing';
				await app.vault.modify(targetFile, updatedText);
			} catch (error) {
				Log.error(
					'library-sync-dependency-docs',
					`Dependency documentation sync failed during ${ phase }.`,
					error
				);
				throw error;
			}
		}
	};
};

/**
 * Scans every Library module file and builds a reverse dependency map from
 * imported module path to the sorted set of files that import it directly,
 * along with resolved/unresolved import counts and unresolved entries.
 */
async function buildDependencyGraph(app, files) {
	const importersByModule = new Map();
	const unresolvedEntries = [];
	let resolvedImportCount = 0;

	for (const file of files) {
		const source = await app.vault.cachedRead(file);
		const { resolvedSpecifiers, unsupported } = extractImports(source);

		for (const specifier of resolvedSpecifiers) {
			if (!specifier.startsWith('.')) {
				unresolvedEntries.push({ file: file.path, text: specifier });
				continue;
			}
			const modulePath = resolveRelativeSpecifier(file.path, specifier);
			resolvedImportCount += 1;
			if (!importersByModule.has(modulePath)) {
				importersByModule.set(modulePath, new Set());
			}
			importersByModule.get(modulePath).add(file.path);
		}

		for (const text of unsupported) {
			unresolvedEntries.push({ file: file.path, text });
		}
	}

	return {
        importersByModule,
        unresolvedEntries,
        resolvedImportCount
    };
}

/**
 * Collects every .js file below the Library module's source folder,
 * sorted deterministically by vault path.
 */
function collectLibraryJsFiles(app) {
	return app.vault
		.getFiles()
		.filter((file) => file.path.startsWith(`${ LIBRARY_SOURCE_FOLDER }/`) && file.path.endsWith('.js'))
		.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Extracts static relative import specifiers from a single file's source,
 * separating cleanly-resolved imports from dynamic imports, re-exports, and
 * any import statement that doesn't match the module's supported forms.
 */
function extractImports(source) {
	const cleaned = stripComments(source);
	const resolvedSpecifiers = [];
	const unsupported = [];

	for (const match of cleaned.matchAll(IMPORT_STATEMENT_PATTERN)) {
		const statement = match[0].trim();
		const captured = statement.match(STATIC_IMPORT_CAPTURE_PATTERN);
		if (captured) {
			resolvedSpecifiers.push(captured[1]);
		} else {
			unsupported.push(statement);
		}
	}

	for (const match of cleaned.matchAll(DYNAMIC_IMPORT_PATTERN)) {
		unsupported.push(match[0].trim());
	}

	for (const match of cleaned.matchAll(RE_EXPORT_PATTERN)) {
		unsupported.push(match[0].trim());
	}

	return { resolvedSpecifiers, unsupported };
}

/**
 * Renders the full generated dependency block, including the split
 * Library-internal / external-shared-module tables, an unresolved-imports
 * table, and a generation report, for insertion between the document's
 * marker comments.
 */
function renderDependencyBlock(
    {
        importersByModule,
        unresolvedEntries,
        resolvedImportCount
    },
    filesScanned,
    generatedAt
) {
	const allModules = [...importersByModule.keys()];
	const libraryModules = allModules.filter((modulePath) => modulePath.startsWith(`${ LIBRARY_SOURCE_FOLDER }/`));
	const externalModules = allModules.filter((modulePath) => !modulePath.startsWith(`${ LIBRARY_SOURCE_FOLDER }/`));

	const unresolvedTable = unresolvedEntries.length === 0
		? '_None detected._'
		: [
			'| File | Import text |',
			'| ---- | ----------- |',
			...unresolvedEntries.map(({ file, text }) => `| \`${ file }\` | \`${ text.replace(/\|/g, '\\|') }\` |`)
		].join('\n');

	return [
		'### Generated Direct Dependency Map',
		'',
		`> Generated by \`library-sync-dependency-docs.js\` on ${ generatedAt }. This map describes static imports only.`,
		'',
		'#### Library Module Files',
		'',
		renderModuleTable(libraryModules, importersByModule),
		'',
		'#### External Shared Modules',
		'',
		renderModuleTable(externalModules, importersByModule),
		'',
		'#### Unresolved / Unsupported Imports',
		'',
		unresolvedTable,
		'',
		'#### Generation Report',
		'',
		'| Metric | Value |',
		'| ------ | ----- |',
		`| Library files scanned | ${ filesScanned } |`,
		`| Static imports resolved | ${ resolvedImportCount } |`,
		`| Unresolved / unsupported imports | ${ unresolvedEntries.length } |`,
		`| Target document updated | \`${ TARGET_DOCUMENT_PATH }\` |`
	].join('\n');
}

/**
 * Renders a Markdown table for one group of module rows, joining each
 * module's importers with a line break to match the module's existing
 * "Used By" table convention.
 */
function renderModuleTable(modulePaths, importersByModule) {
	if (modulePaths.length === 0) {
		return '_None detected._';
	}
	const rows = modulePaths
		.sort((a, b) => a.localeCompare(b))
		.map((modulePath) => {
			const importers = [...importersByModule.get(modulePath)].sort((a, b) => a.localeCompare(b));
			return `| \`${ modulePath }\` | ${ importers.map((path) => `\`${ path }\``).join('<br>') } |`;
		});
	return ['| Module | Direct importers |', '| ------ | ----------------- |', ...rows].join('\n');
}

/**
 * Resolves a relative import specifier against the importing file's own
 * folder into a normalized, vault-relative path.
 */
function resolveRelativeSpecifier(importingFilePath, specifier) {
	const resultParts = importingFilePath.split('/').slice(0, -1);
	for (const part of specifier.split('/')) {
		if (part === '' || part === '.') continue;
		if (part === '..') {
			resultParts.pop();
			continue;
		}
		resultParts.push(part);
	}
	return resultParts.join('/');
}

/**
 * Replaces the contents between the generated dependency markers in a
 * document's text, throwing if the markers are missing, duplicated, or
 * out of order rather than writing a malformed result.
 */
function spliceGeneratedBlock(documentText, renderedBlock) {
	const beginCount = documentText.split(MARKER_BEGIN).length - 1;
	const endCount = documentText.split(MARKER_END).length - 1;

	if (beginCount === 0 || endCount === 0) {
		const error = new Error('Generated dependency table markers are missing from the target document.');
		Log.error(
			'library-sync-dependency-docs',
			error.message,
			error
		);
		throw error;
	}
	if (beginCount > 1 || endCount > 1) {
		const error = new Error('Generated dependency table markers are duplicated in the target document.');
		Log.error(
			'library-sync-dependency-docs',
			error.message,
			error
		);
		throw error;
	}

	const beginIndex = documentText.indexOf(MARKER_BEGIN);
	const endIndex = documentText.indexOf(MARKER_END);

	if (endIndex < beginIndex) {
		const error = new Error('Generated dependency table markers are out of order in the target document.');
		Log.error(
			'library-sync-dependency-docs',
			error.message,
			error
		);
		throw error;
	}

	const head = documentText.slice(0, beginIndex + MARKER_BEGIN.length);
	const tail = documentText.slice(endIndex);

	return `${ head }\n\n${ renderedBlock }\n\n${ tail }`;
}

/**
 * Removes block and line comments from a JavaScript source string so
 * commented-out code is never mistaken for a live import declaration.
 */
function stripComments(source) {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/(^|[^:])\/\/.*$/gm, '$1');
}