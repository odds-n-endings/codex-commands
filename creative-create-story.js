import {
	Manuscript,
	Story,
	StoryArchive,
} from '../.codex/creative/objects';
import { StoryModal } from '../.codex/creative/modals/StoryModal.js';
import { sceneTemplateSuffixForStage } from '../.codex/creative/controls/scene-template-helpers.js';
import { getPriorStage } from '../.codex/creative/controls/manuscript-pipelines.js';
import { Log } from '../.codex/utils/logger.js';

/**
 * Unlike create-scene, this command's target folder isn't a scaffold-free
 * destination -- it's the story's own already-cloned submodule root (a lean
 * submodule containing just README/.github, activated via the vault's git
 * workflow before this command runs), and everything below gets built inside
 * it: the Story note itself, one Manuscript per pipeline stage, its
 * scene Templater templates, the ARCHIVE dashboard and its DRAFTS/CHANGELOG
 * folders.
 * checkCallback (not callback) so the command is only enabled from within a
 * resolvable folder -- checking=true just resolves/validates the folder and
 * returns a boolean; checking=false does that same resolution again (cheap)
 * and then fires the actual async modal + scaffold work below. Must use
 * concise method syntax (not a lambda) or `this.app` is undefined -- see
 * invocable-scripts.md.
 */
export function buildInvokeCommand(app) {
	return {
		name: 'Create Story',
		id: 'creative-create-story',
		checkCallback(checking) {
			const folder = app.workspace.getActiveFile()?.parent?.path ?? '';
			if (!folder) {
				return false;
			}

			if (!checking) {
				runCreateStory(app, folder);
			}

			return true;
		}
	};
};

async function runCreateStory(app, folder) {
	new StoryModal(app, async (result) => {
		try {
			// Built (not yet written) first, so its storyTag/pipeline/title
			// getters are available for wiring up Manuscript/StoryArchive.
			// manuscriptLinks gets populated as each Manuscript is created
			// below, then story.create() writes the file last -- correct on
			// its one and only write, no follow-up re-save needed.
			// Filename and title both take the name of the folder this
			// command is run from (e.g. "Dark Side of the Moon/" ->
			// "Dark Side of the Moon.md", title "Dark Side of the Moon")
			// -- no longer collected via the modal.
			const folderName = folder.split('/').pop();
			const story = new Story(app, {
				folder,
				filename: folderName,
				title: folderName,
				...result
			});

			// title-abbv names this story's generated scene Templater
			// templates below -- StoryModal marks it required, but has no
			// built-in way to block an empty submit, so the actual
			// enforcement lives here.
			if (!story.titleAbbv) {
				const error = new Error('Title abbreviation is required to scaffold a story -- it names the generated scene templates.');
				Log.error(
					'create-story',
					error.message,
					error
				);
				throw error;
			}

			const pipeline = story.pipeline; // throws if category has no defined pipeline

			// Scene Templater templates -- created first (one to three .md
			// files per Story.buildSceneTemplates(), placed at the story
			// project's own root, not inside any stage folder) since each
			// stage's Manuscript below needs a template's actual vault path
			// to wire into its own longform.sceneTemplate.
			const sceneTemplatePaths = {}; // suffix -> vault-relative path (with .md)
			for (const {
					filename,
					suffix,
					content
				} of story.buildSceneTemplates()) {
				const templateFile = await app.vault.create(`${ folder }/${ filename }`, content);
				sceneTemplatePaths[suffix] = templateFile.path;
				Log.log('create-story', `Scene template created: ${ filename }`);
			}

			for (const stage of pipeline) {
				const stageFolder = `${ folder }/${ stage }`;
				await app.vault.createFolder(stageFolder);

				const manuscript = new Manuscript(app, {
					folder: stageFolder,
					filename: stage,
					category: 'draft',
					affiliations: story.affiliations,
					// Manuscript doesn't auto-include the story's tag the way
					// Story does for itself -- every dashboard query in both
					// Manuscript.js and Story.js filters on #storyTag, so this
					// has to be passed explicitly or the dashboards silently
					// find nothing.
					tags: [ story.storyTag ],
					stage,
					editorialStatus: '',
					priorStage: getPriorStage(story.category, stage),
					context: '',
					storyTag: story.storyTag,
					title: story.title,
					sceneTemplate: sceneTemplatePaths[sceneTemplateSuffixForStage(stage)] ?? '',
				});
				const manuscriptFile = await manuscript.create();
				story.manuscriptLinks[stage] = manuscriptFile.basename;
				Log.log('create-story', `Manuscript created for stage "${ stage }".`);
			}

			const archiveFolder = `${ folder }/ARCHIVE`;
			await app.vault.createFolder(archiveFolder);
			await app.vault.createFolder(`${ archiveFolder }/DRAFTS`);
			await app.vault.createFolder(`${ archiveFolder }/CHANGELOG`);
			// Empty folders don't survive a git commit on their own.
			await app.vault.create(`${ archiveFolder }/DRAFTS/.gitkeep`, '');
			await app.vault.create(`${ archiveFolder }/CHANGELOG/.gitkeep`, '');

			const storyArchive = new StoryArchive(app, {
				folder: archiveFolder,
				filename: 'ARCHIVE',
				category: 'overview',
				moduleTag: story.storyTag,
			});
			await storyArchive.create();
			Log.log('create-story', 'ARCHIVE dashboard created.');

			const storyFile = await story.create();
			await app.workspace.getLeaf(false).openFile(storyFile);
		} catch (error) {
			Log.error(
				'create-story',
				'Story scaffold failed partway through -- check the vault for partially-created folders/notes before retrying.',
				error
			);
			throw error;
		}
	}).open();
}