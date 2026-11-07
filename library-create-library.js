import { Library } from '../.codex/library/objects/Library.js';
import { Glossary } from '../.codex/library/objects/Glossary.js';
import { LibraryModal } from '../.codex/library/modals/LibraryModal.js';
import { buildBibliographyBase, buildGlossaryBaseContent } from '../.codex/library/base-builders'
import { Log } from '../.codex/utils/logger.js';

/**
 * checkCallback (not callback) so the command is only enabled from within a
 * resolvable folder -- checking=true just resolves the folder and returns a
 * boolean; checking=false does that same resolution again (cheap) and then
 * fires the actual async modal + scaffold work below.
 */
export function buildInvokeCommand(app) {
	return {
		name: 'Create Library',
		id: 'library-create-library',
		checkCallback(checking) {
			const folder = app.workspace.getActiveFile()?.parent?.path ?? '';
			if (!folder) {
				return false;
			}

			if (!checking) {
				runCreateLibrary(app, folder);
			}

			return true;
		}
	};
};

async function runCreateLibrary(app, folder) {
	new LibraryModal(app, async (result) => {
		try {
			// libraryName names the generated bibliography file -- LibraryModal
			// has no built-in way to block an empty submit, so the actual
			// enforcement lives here.
			if (!result.libraryName) {
				const error = new Error('Library name is required -- it names the generated bibliography file.');
				Log.error(
					'create-library',
					error.message,
					error
				);
				throw error;
			}

			const worksFolderName = result.worksFolderName || 'works';
			const tags = Array.from(
				new Set([...(result.tags ?? []), result.libraryTag].filter(Boolean))
			);

			const library = new Library(app, {
				folder,
				...result,
				tags,
			});

			for (const subfolder of [
				'authors',
				'collections',
				worksFolderName,
				'glossary',
				'ARCHIVE',
			]) {
				await app.vault.createFolder(`${ folder }/${ subfolder }`);
				// Empty folders don't survive a git commit on their own.
				await app.vault.create(`${ folder }/${ subfolder }/.gitkeep`, '');
			}

			const bibliographyFilename = `${ result.libraryName } Bibliography.base`;
			await app.vault.create(
				`${ folder }/${ bibliographyFilename }`,
				buildBibliographyBase(result.libraryTag)
			);
			Log.log('create-library', `${ bibliographyFilename } created.`);

			const glossaryFolder = `${ folder }/glossary`;
			const glossaryBaseFilename = `${ result.libraryName } Glossary.base`;
			await app.vault.create(
				`${ glossaryFolder }/${ glossaryBaseFilename }`,
				buildGlossaryBaseContent(result.libraryTag)
			);
			Log.log('create-library', `${ glossaryBaseFilename } created.`);

			const glossary = new Glossary(app, {
				folder: glossaryFolder,
				libraryName: result.libraryName,
				libraryTag: result.libraryTag,
				tags,
			});
			await glossary.create();
			Log.log('create-library', `Glossary note created: ${ glossary.path }`);

			const libraryFile = await library.create();

			await app.fileManager.processFrontMatter(libraryFile, (frontmatter) => {
				frontmatter['sorting-spec'] = buildSortingSpec(bibliographyFilename, worksFolderName);
			});

			await app.workspace.getLeaf(false).openFile(libraryFile);
			Log.log('create-library', `Library created: ${ libraryFile.path }`);
		} catch (error) {
			Log.error(
				'create-library',
				'Library scaffold failed partway through -- check the vault for partially-created folders/notes before retrying.',
				error
			);
			throw error;
		}
	}).open();
}

/**
 * <works> in the sorting-spec listing below is whichever name the curator
 * gave works-folder-name (or the works fallback, if left blank).
 */
function buildSortingSpec(bibliographyFilename, worksFolderName) {
	return [
		bibliographyFilename,
		worksFolderName,
		'authors',
		'collections',
		'glossary',
		'ARCHIVE',
		'',
	].join('\n');
}