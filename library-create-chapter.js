import { Chapter } from '../.codex/library/objects/Chapter.js';
import { ChapterModal } from '../.codex/library/modals/ChapterModal.js';
import { Log } from '../.codex/utils/logger.js';

const REQUIRED_CITATION_FIELDS = [
	'authors',
	'year',
	'parentWork'
];

export function buildInvokeCommand(app) {
	return {
		name: 'Create Library Chapter',
		id: 'library-create-chapter',
		callback() {
			new ChapterModal(app, async (result) => {
				try {
					const missing = REQUIRED_CITATION_FIELDS.filter(
						(key) => !result[key] || (Array.isArray(result[key]) && result[key].length === 0)
					);
					if (missing.length > 0) {
						const error = new Error(
							`Chapter requires the following field(s) to build its citation: ${ missing.join(', ') }.`
						);
						Log.error(
							'library-create-chapter',
							error.message,
							error
						);
						throw error;
					}

					const folder = await Chapter.resolveFolder(app);
					const chapter = new Chapter(app, { ...result, folder });
					const file = await chapter.create();
					await app.workspace.getLeaf(false).openFile(file);
				} catch (error) {
					Log.error(
						'library-create-chapter',
						'Chapter creation failed.',
						error
					);
					throw error;
				}
			}).open();
		}
	};
};