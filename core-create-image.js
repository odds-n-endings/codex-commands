import { Image } from '../.codex/core/objects/Image.js';
import { ImageModal } from '../.codex/core/modals/ImageModal.js';
import { Log } from '../.codex/utils/logger.js';

export async function buildInvokeCommand(app) {
	return {
		name: 'Create Image',
		id: 'core-create-image',
		async callback() {
			new ImageModal(app, async (result) => {
				try {
					if (!result.imageVaultPath && !result.source) {
						const error = new Error('Image requires either a vault path or a source to be meaningful.');
						Log.error(
							'core-create-image',
							error.message,
							error
						);
						throw error;
					}

					const folder = await Image.resolveFolder(app);
					const image = new Image(app, { ...result, folder });
					const file = await image.create();
					await app.workspace.getLeaf(false).openFile(file);
				} catch (error) {
					Log.error(
						'core-create-image',
						'Image creation failed.',
						error
					);
					throw error;
				}
			}).open();
		}
	};
};