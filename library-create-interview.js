import { Interview } from '../.codex/library/objects/Interview.js';
import { InterviewModal } from '../.codex/library/modals/InterviewModal.js';
import { Log } from '../.codex/utils/logger.js';

const REQUIRED_CITATION_FIELDS = ['interviewee', 'year'];

export function buildInvokeCommand(app) {
	return {
		name: 'Create Library Interview',
		id: 'library-create-interview',
		callback() {
			new InterviewModal(app, async (result) => {
				try {
					const missing = REQUIRED_CITATION_FIELDS.filter(
						(key) => !result[key] || (Array.isArray(result[key]) && result[key].length === 0)
					);
					if (missing.length > 0) {
						const error = new Error(
							`Interview requires the following field(s) to build its citation: ${ missing.join(', ') }.`
						);
						Log.error(
							'library-create-interview',
							error.message,
							error
						);
						throw error;
					}

					const folder = await Interview.resolveFolder(app);
					const interview = new Interview(app, { ...result, folder });
					const file = await interview.create();
					await app.workspace.getLeaf(false).openFile(file);
				} catch (error) {
					Log.error(
						'library-create-interview',
						'Interview creation failed.',
						error
					);
					throw error;
				}
			}).open();
		}
	};
};