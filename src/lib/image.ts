export type PreparedImage = {
	blob: Blob;
	extension: string;
};

export async function prepareAvatar(file: File, size = 256): Promise<PreparedImage> {
	const bitmap = await createImageBitmap(file);

	try {
		const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
		const width = Math.max(1, Math.round(bitmap.width * scale));
		const height = Math.max(1, Math.round(bitmap.height * scale));

		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;

		const context = canvas.getContext('2d');
		if (!context) throw new Error('Браузер не смог обработать картинку.');

		context.imageSmoothingEnabled = true;
		context.imageSmoothingQuality = 'high';
		context.drawImage(bitmap, 0, 0, width, height);

		const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/webp', 0.9));
		if (!blob) throw new Error('Браузер не смог сжать картинку.');

		return { blob, extension: blob.type === 'image/webp' ? 'webp' : 'png' };
	} finally {
		bitmap.close();
	}
}
