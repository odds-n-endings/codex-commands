import { AuthorModal } from '../.codex/library/modals/AuthorModal.js';
import { Author } from '../.codex/library/objects/Author.js';
import { Log } from '../.codex/utils/logger.js';

export function buildInvokeCommand(app) {
	return {
		name: 'Create Library Author',
		id: 'library-create-author',
		callback() {
			new AuthorModal(app, async (result) => {
				try {
					if (!result.lastName) {
						const error = new Error('Author requires a last name to be usable in citations.');
						Log.error(
							'library-create-author',
							error.message,
							error
						);
						throw error;
					}

					const folder = await Author.resolveFolder(app);
					const author = new Author(app, { ...result, folder });
					const file = await author.create();
					await app.workspace.getLeaf(false).openFile(file);
				} catch (error) {
					Log.error(
						'library-create-author',
						'Author creation failed.',
						error
					);
					throw error;
				}
			}).open();
		}
	};
};