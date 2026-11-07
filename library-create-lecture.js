import { Lecture } from '../.codex/library/objects/Lecture.js';
import { LectureModal } from '../.codex/library/modals/LectureModal.js';
import { Log } from '../.codex/utils/logger.js';

const REQUIRED_CITATION_FIELDS = ['authors', 'year'];

export function buildInvokeCommand(app) {
	return {
		name: 'Create Library Lecture',
		id: 'library-create-lecture',
		callback() {
			new LectureModal(app, async (result) => {
				try {
					const missing = REQUIRED_CITATION_FIELDS.filter(
						(key) => !result[key] || (Array.isArray(result[key]) && result[key].length === 0)
					);
					if (missing.length > 0) {
						const error = new Error(
							`Lecture requires the following field(s) to build its citation: ${ missing.join(', ') }.`
						);
						Log.error(
							'library-create-lecture',
							error.message,
							error
						);
						throw error;
					}

					const folder = await Lecture.resolveFolder(app);
					const lecture = new Lecture(app, { ...result, folder });
					const file = await lecture.create();
					await app.workspace.getLeaf(false).openFile(file);
				} catch (error) {
					Log.error(
						'library-create-lecture',
						'Lecture creation failed.',
						error
					);
					throw error;
				}
			}).open();
		}
	}
};