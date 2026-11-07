import { Report } from '../.codex/library/objects/Report.js';
import { ReportModal } from '../.codex/library/modals/ReportModal.js';
import { Log } from '../.codex/utils/logger.js';

export function buildInvokeCommand(app) {
	return {
		name: 'Create Library Report',
		id: 'library-create-report',
		callback() {
			new ReportModal(app, async (result) => {
				try {
					const hasAuthorship = (result.authors && result.authors.length > 0)
						|| Boolean(result.commissioningBody);

					const missing = [];
					if (!hasAuthorship) {
						missing.push('authors or commissioning-body');
					}
					if (!result.year) {
						missing.push('year');
					}
					if (missing.length > 0) {
						const error = new Error(
							`Report requires the following field(s) to build its citation: ${ missing.join(', ') }.`
						);
						Log.error(
							'library-create-report',
							error.message,
							error
						);
						throw error;
					}

					const folder = await Report.resolveFolder(app);
					const report = new Report(app, { ...result, folder });
					const file = await report.create();
					await app.workspace.getLeaf(false).openFile(file);
				} catch (error) {
					Log.error(
						'library-create-report',
						'Report creation failed.',
						error
					);
					throw error;
				}
			}).open();
		}
	};
};