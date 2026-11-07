import { Monograph } from '../.codex/library/objects/Monograph.js';
import { MonographModal } from '../.codex/library/modals/MonographModal.js';
import { Log } from '../.codex/utils/logger.js';

const REQUIRED_CITATION_FIELDS = ['authors', 'year'];

export function buildInvokeCommand(app) {
	return {
		name: 'Create Library Monograph',
		id: 'library-create-monograph',
		callback() {
			new MonographModal(app, async (result) => {
				try {
					const missing = REQUIRED_CITATION_FIELDS.filter(
						(key) => !result[key] || (Array.isArray(result[key]) && result[key].length === 0)
					);
					if (missing.length > 0) {
						const error = new Error(
							`Monograph requires the following field(s) to build its citation: ${ missing.join(', ') }.`
						);
						Log.error(
							'library-create-monograph',
							error.message,
							error
						);
						throw error;
					}

					const folder = await Monograph.resolveFolder(app);
					const monograph = new Monograph(app, { ...result, folder });
					const file = await monograph.create();
					await app.workspace.getLeaf(false).openFile(file);
				} catch (error) {
					Log.error(
						'library-create-monograph',
						'Monograph creation failed.',
						error
					);
					throw error;
				}
			}).open();
		}
	};
};