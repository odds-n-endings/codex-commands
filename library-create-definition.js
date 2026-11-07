import { Definition } from '../.codex/library/objects/Definition.js';
import { DefinitionModal } from '../.codex/library/modals/DefinitionModal.js';
import { resolveLibraryNote } from '../.codex/resolution';
import { Log } from '../.codex/utils/logger.js';

export function buildInvokeCommand(app) {
	return {
		name: 'Create Library Definition',
		id: 'library-create-definition',
		callback() {
			new DefinitionModal(app, async (result) => {
				try {
					const folder = await Definition.resolveFolder(app);

					const libraryNote = resolveLibraryNote(app, folder);
					const libraryTag = app.metadataCache.getFileCache(libraryNote)?.frontmatter?.['library-tag'] ?? '';
					const tags = Array.from(
						new Set([...(result.tags ?? []), libraryTag].filter(Boolean))
					);

					const definition = new Definition(app, { ...result, folder, tags });
					const file = await definition.create();
					await app.workspace.getLeaf(false).openFile(file);
				} catch (error) {
					Log.error(
						'library-create-definition',
						'Definition creation failed.',
						error
					);
					throw error;
				}
			}).open();
		}
	};
};