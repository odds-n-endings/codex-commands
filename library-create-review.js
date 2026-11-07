import { Review } from '../.codex/library/objects/Review.js';
import { ReviewModal } from '../.codex/library/modals/ReviewModal.js';
import { Log } from '../.codex/utils/logger.js';

const REQUIRED_CITATION_FIELDS = [
    'authors',
    'year',
    'subjectWork'
];

export function buildInvokeCommand(app) {
	return {
		name: 'Create Library Review',
		id: 'library-create-review',
		callback() {
			new ReviewModal(app, async (result) => {
				try {
					const missing = REQUIRED_CITATION_FIELDS.filter(
						(key) => !result[key] || (Array.isArray(result[key]) && result[key].length === 0)
					);
					if (missing.length > 0) {
						const error = new Error(
							`Review requires the following field(s) to build its citation: ${ missing.join(', ') }.`
						);
						Log.error(
							'library-create-review',
							error.message,
							error
						);
						throw error;
					}

					const folder = await Review.resolveFolder(app);
					const review = new Review(app, { ...result, folder });
					const file = await review.create();
					await app.workspace.getLeaf(false).openFile(file);
				} catch (error) {
					Log.error(
						'library-create-review',
						'Review creation failed.',
						error
					);
					throw error;
				}
			}).open();
		}
	};
};