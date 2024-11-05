/// https://github.com/dotnet/runtime/issues/67290#issuecomment-1098865533
const FS = window.Module.FS;

export function synchronizeMemoryFileSystemWithIndexedDb(fullFileName, version = 1) {
	const fileSystem = "MemoryFileSystem";
	const filename = fullFileName.split(/[\\\/]/).pop();
	const fullPath = fullFileName.substring(0, fullFileName.lastIndexOf('/') + 1);

	return new Promise((res, rej) => {
		const dbRequest = window.indexedDB.open(fileSystem, version);

		dbRequest.onupgradeneeded = () => {
			dbRequest.result.createObjectStore(fullPath, { keypath: 'id' });
		};

		dbRequest.onsuccess = () => {
			const req = dbRequest.result.transaction(fullPath, 'readonly').objectStore(fullPath).get(filename);

			req.onsuccess = () => {
				FS.createPath(".", fullPath, true, true);
				FS.createDataFile(".", fullFileName, req.result, true, true, true);
				res();
			};
		};

		let lastModifiedTime = new Date();

		setInterval(() => {
			if (FS.analyzePath(fullFileName).exists) {
				const stats = FS.stat(fullFileName);
				if (stats.mtime.valueOf() !== lastModifiedTime.valueOf()) {
					lastModifiedTime = stats.mtime;
					const data = FS.readFile(fullFileName);

					const folder = dbRequest.result.transaction(fullPath, 'readwrite').objectStore(fullPath);
					folder.put(data, filename);
					folder.put(stats.mtime, filename + ".mtime");
				}
			}
		}, 1000);
	});
}

export function downloadFileFromMemoryFileSystem(fullFileName, contentType) {
	if (FS.analyzePath(fullFileName).exists) {
		const contentData = FS.readFile(fullFileName);
		const filename = fullFileName.split(/[\\\/]/).pop();
		downloadContentData(contentData, filename, contentType);
	}
}

export function downloadContentData(contentData, filename, contentType) {
	// Create the URL
	const file = new File([contentData], filename, { type: contentType });
	const exportUrl = URL.createObjectURL(file);

	// Create the <a> element and click on it
	const a = document.createElement("a");
	document.body.appendChild(a);
	a.href = exportUrl;
	a.download = filename;
	a.target = "_self";
	a.click();

	// We don't need to keep the object URL, let's release the memory
	// On older versions of Safari, it seems you need to comment this line...
	URL.revokeObjectURL(exportUrl);
}
