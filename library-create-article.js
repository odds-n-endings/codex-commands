import { Article } from '../.codex/library/objects/Article.js';
import { ArticleModal } from '../.codex/library/modals/ArticleModal.js';
import { Log } from '../.codex/utils/logger.js';

const REQUIRED_CITATION_FIELDS = [
    'authors',
    'year',
    'collections',
    'volume',
    'issue',
    'pageRange'
];

export function buildInvokeCommand(app) {
	return {
		name: 'Create Library Article',
		id: 'library-create-article',
		callback() {
			new ArticleModal(app, async (result) => {
				try {
					const missing = REQUIRED_CITATION_FIELDS.filter(
						(key) => !result[key] || (Array.isArray(result[key]) && result[key].length === 0)
					);
					if (missing.length > 0) {
						const error = new Error(
							`Article requires the following field(s) to build its citation: ${ missing.join(', ') }.`
						);
						Log.error(
							'library-create-article',
							error.message,
							error
						);
						throw error;
					}

					const folder = await Article.resolveFolder(app);
					const article = new Article(app, { ...result, folder });
					const file = await article.create();
					await app.workspace.getLeaf(false).openFile(file);
				} catch (error) {
					Log.error(
						'library-create-article',
						'Article creation failed.',
						error
					);
					throw error;
				}
			}).open();
		}
	};
};