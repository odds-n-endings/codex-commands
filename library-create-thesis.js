import { Thesis } from '../.codex/library/objects/Thesis.js';
import { ThesisModal } from '../.codex/library/modals/ThesisModal.js';
import { Log } from '../.codex/utils/logger.js';

const REQUIRED_CITATION_FIELDS = [
	'authors',
	'year',
	'institution',
	'degree'
];

export function buildInvokeCommand(app) {
	return {
		name: 'Create Library Thesis',
		id: 'library-create-thesis',
		callback() {
			new ThesisModal(app, async (result) => {
				try {
					const missing = REQUIRED_CITATION_FIELDS.filter(
						(key) => !result[key] || (Array.isArray(result[key]) && result[key].length === 0)
					);
					if (missing.length > 0) {
						const error = new Error(
							`Thesis requires the following field(s) to build its citation: ${ missing.join(', ') }.`
						);
						Log.error(
							'library-create-thesis',
							error.message,
							error
						);
						throw error;
					}

					const folder = await Thesis.resolveFolder(app);
					const thesis = new Thesis(app, { ...result, folder });
					const file = await thesis.create();
					await app.workspace.getLeaf(false).openFile(file);
				} catch (error) {
					Log.error(
						'library-create-thesis',
						'Thesis creation failed.',
						error
					);
					throw error;
				}
			}).open();
		}
	}
};