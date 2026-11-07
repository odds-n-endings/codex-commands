import { Scene } from '../.codex/creative/objects/Scene.js';
import { SceneModal } from '../.codex/creative/modals/SceneModal.js';

// No folder-gating to check yet (still a stub), so `callback` -- not
// `checkCallback` -- is the right fit here; concise method syntax so
// `this.app` resolves (a lambda here would leave `this` undefined).
export function buildInvokeCommand(app) {
	return {
		name: 'Create Creative Scene',
		id: 'creative-create-scene',
		callback() {
			new SceneModal(app, async (result) => {
			const { filename, ...rest } = result;
			const folder = app.workspace.getActiveFile()?.parent?.path ?? '';
			const scene = new Scene(app, { folder, filename, ...rest });
			const file = await scene.create();
			await app.workspace.getLeaf(false).openFile(file);
			}).open();
		}
	};
};