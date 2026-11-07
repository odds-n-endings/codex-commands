import { Entry } from '../.codex/library/objects/Entry.js';
import { EntryModal } from '../.codex/library/modals/EntryModal.js';
import { Log } from '../.codex/utils/logger.js';

const REQUIRED_CITATION_FIELDS = ['entryTerm', 'referenceWork'];

export function buildInvokeCommand(app) {
	return {
		name: 'Create Library Entry',
		id: 'library-create-entry',
		callback() {
			new EntryModal(app, async (result) => {
				try {
					const missing = REQUIRED_CITATION_FIELDS.filter(
						(key) => !result[key] || (Array.isArray(result[key]) && result[key].length === 0)
					);
					if (missing.length > 0) {
						const error = new Error(
							`Entry requires the following field(s) to build its citation: ${ missing.join(', ') }.`
						);
						Log.error(
							'library-create-entry',
							error.message,
							error
						);
						throw error;
					}

					const folder = await Entry.resolveFolder(app);
					const entry = new Entry(app, { ...result, folder });
					const file = await entry.create();
					await app.workspace.getLeaf(false).openFile(file);
				} catch (error) {
					Log.error(
						'library-create-entry',
						'Entry creation failed.',
						error
					);
					throw error;
				}
			}).open();
		}
	};
};