import { Record } from '../.codex/library/objects/Record.js';
import { RecordModal } from '../.codex/library/modals/RecordModal.js';
import { Log } from '../.codex/utils/logger.js';

const REQUIRED_CITATION_FIELDS = ['authors', 'year'];

export function buildInvokeCommand(app) {
	return {
		name: 'Create Library Record',
		id: 'library-create-record',
		callback() {
			new RecordModal(app, async (result) => {
				try {
					const missing = REQUIRED_CITATION_FIELDS.filter(
						(key) => !result[key] || (Array.isArray(result[key]) && result[key].length === 0)
					);
					if (missing.length > 0) {
						const error = new Error(
							`Record requires the following field(s) to build its citation: ${ missing.join(', ') }.`
						);
						Log.error(
							'library-create-record',
							error.message,
							error
						);
						throw error;
					}

					const folder = await Record.resolveFolder(app);
					const record = new Record(app, { ...result, folder });
					const file = await record.create();
					await app.workspace.getLeaf(false).openFile(file);
				} catch (error) {
					Log.error(
						'library-create-record',
						'Record creation failed.',
						error
					);
					throw error;
				}
			}).open();
		}
	};
};