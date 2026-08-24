/*! v1.3.0 | h679ba67b */
//#region src/blocks/columns/columns.ts
function decorate(block) {
	const cols = [...block.firstElementChild?.children ?? []];
	block.classList.add(`columns-${cols.length}-cols`);
	[...block.children].forEach((row) => {
		[...row.children].forEach((col) => {
			const pic = col.querySelector("picture");
			if (pic) {
				const picWrapper = pic.closest("div");
				if (picWrapper && picWrapper.children.length === 1) picWrapper.classList.add("columns-img-col");
			}
		});
	});
}
//#endregion
export { decorate as default };
