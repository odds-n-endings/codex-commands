import { Glossary } from '../.codex/library/objects/Glossary.js';
import { buildGlossaryBaseContent } from '../.codex/library/base-builders';
import { resolveLibraryFolder, resolveLibraryNote } from '../.codex/resolution';
import { Log } from '../.codex/utils/logger.js';

/**
 * Backfills a Glossary note, its glossary/ folder, and its companion .base
 * file onto a library that predates the Glossary feature, or that is
 * otherwise missing one or more of those three pieces. Idempotent -- only
 * creates whatever is currently missing, leaving anything that already
 * exists untouched.
 *
 * checkCallback (not callback) so the command is only enabled from inside
 * an existing library. resolveLibraryFolder() throws (via Log.error) when
 * the active file isn't inside a library -- checking=true swallows that
 * via try/catch to disable the command, which does mean a Notice fires on
 * every availability check made outside a library, not just on invocation.
 */
export function buildInvokeCommand(app) {
	return {
		name: 'Create Library Glossary',
		id: 'library-create-glossary',
		checkCallback(checking) {
			const startFolderPath = app.workspace.getActiveFile()?.parent?.path ?? '';

			let libraryFolder;
			try {
				libraryFolder = resolveLibraryFolder(app, startFolderPath);
			} catch {
				return false;
			}

			if (!checking) {
				runCreateGlossary(app, libraryFolder);
			}

			return true;
		}
	};
};

async function runCreateGlossary(app, libraryFolder) {
	try {
		const libraryNote = resolveLibraryNote(app, libraryFolder);
		const libraryFrontmatter = app.metadataCache.getFileCache(libraryNote)?.frontmatter ?? {};
		const libraryName = libraryFrontmatter['library-name'] ?? '';
		const libraryTag = libraryFrontmatter['library-tag'] ?? '';

		const glossaryFolder = `${ libraryFolder }/glossary`;
		if (!app.vault.getAbstractFileByPath(glossaryFolder)) {
			await app.vault.createFolder(glossaryFolder);
			Log.log('create-glossary', `${ glossaryFolder } created.`);
		}

		const glossaryBaseFilename = `${ libraryName } glossary.base`;
		const glossaryBasePath = `${ glossaryFolder }/${ glossaryBaseFilename }`;
		if (!app.vault.getAbstractFileByPath(glossaryBasePath)) {
			await app.vault.create(
				glossaryBasePath,
				buildGlossaryBaseContent(libraryTag)
			);
			Log.log('create-glossary', `${ glossaryBaseFilename } created.`);
		}

		const glossaryNotePath = `${ glossaryFolder }/glossary.md`;
		if (app.vault.getAbstractFileByPath(glossaryNotePath)) {
			Log.log('create-glossary', `Glossary note already exists at ${ glossaryNotePath } -- nothing further to create.`);
			await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(glossaryNotePath));
			return;
		}

		const glossary = new Glossary(app, {
			folder: glossaryFolder,
			libraryName,
			libraryTag,
			tags: [libraryTag].filter(Boolean),
		});
		const glossaryFile = await glossary.create();

		await app.workspace.getLeaf(false).openFile(glossaryFile);
		Log.log('create-glossary', `Glossary created: ${ glossaryFile.path }`);
	} catch (error) {
		Log.error(
			'create-glossary',
			'Glossary backfill failed partway through -- check the vault for a partially-created folder/note before retrying.',
			error
		);
		throw error;
	}
}