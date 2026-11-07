import { Periodical } from '../.codex/library/objects/Periodical.js';
import { PeriodicalModal } from '../.codex/library/modals/PeriodicalModal.js';
import { Log } from '../.codex/utils/logger.js';

export function buildInvokeCommand(app) {
	return {
		name: 'Create Library Periodical',
		id: 'library-create-periodical',
		callback() {
			new PeriodicalModal(app, async (result) => {
				try {
					if (!result.filterTag) {
						const error = new Error(
							'Periodical requires a filter tag -- it scopes the generated Issues.base file.'
						);
						Log.error(
							'library-create-periodical',
							error.message,
							error
						);
						throw error;
					}

					const folder = await Periodical.resolveFolder(app);
					const { filterTag, ...periodicalOptions } = result;

					const baseFilename = `${ result.filename } Issues.base`;
					await app.vault.create(
						`${ folder }/${ baseFilename }`,
						buildIssuesBase(filterTag)
					);
					Log.log('library-create-periodical', `${ baseFilename } created.`);

					const periodical = new Periodical(app, { ...periodicalOptions, folder });
					const file = await periodical.create();
					await app.workspace.getLeaf(false).openFile(file);
				} catch (error) {
					Log.error(
						'library-create-periodical',
						'Periodical creation failed.',
						error
					);
					throw error;
				}
			}).open();
		}
	};
};

// Scopes the issues table to Collection notes carrying filterTag --
// the curator is responsible for applying that same tag to each
// Collection (issue) belonging to this periodical.
function buildIssuesBase(filterTag) {
	return [
		'filters:',
		'  and:',
		`    - file.hasTag("${ filterTag }")`,
		'    - \'class == "collection"\'',
		'views:',
		'  - type: table',
		'    name: Issues',
		'    order:',
		'      - file.name',
		'      - year',
		'      - citation',
		'',
	].join('\n');
}