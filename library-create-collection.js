import { Collection } from '../.codex/library/objects/Collection.js';
import { CollectionModal } from '../.codex/library/modals/CollectionModal.js';
import { Log } from '../.codex/utils/logger.js';

const REQUIRED_CITATION_FIELDS = ['year'];

export function buildInvokeCommand(app) {
	return {
		name: 'Create Library Collection',
		id: 'library-create-collection',
		callback() {
			new CollectionModal(app, async (result) => {
				try {
					const missing = REQUIRED_CITATION_FIELDS.filter(
						(key) => !result[key] || (Array.isArray(result[key]) && result[key].length === 0)
					);
					if (missing.length > 0) {
						const error = new Error(
							`Collection requires the following field(s) to build its citation: ${ missing.join(', ') }.`
						);
						Log.error(
							'library-create-collection',
							error.message,
							error
						);
						throw error;
					}

					const folder = await Collection.resolveFolder(app);
					const collection = new Collection(app, { ...result, folder });
					const file = await collection.create();
					await app.workspace.getLeaf(false).openFile(file);
				} catch (error) {
					Log.error(
						'library-create-collection',
						'Collection creation failed.',
						error
					);
					throw error;
				}
			}).open();
		}
	};
};