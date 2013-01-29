/**
 * Stores a traversible tree of element types
 * @param rootElement
 */
function SchemaTree(rootElement) {
	this.tree = {};
	this.rootElement = rootElement;
}

SchemaTree.prototype.build = function(elementTitle, elementObject, parentTitle) {
	if (arguments.length == 0) {
		elementTitle = this.rootElement.name;
		elementObject = this.rootElement;
		parentTitle = "";
	}
	if (elementTitle in this.tree) {
		if (parentTitle in this.tree[elementTitle]) {
			// Avoid infinite loops
			return;
		} else {
			this.tree[elementTitle][parentTitle] = elementObject;
		}
	} else {
		this.tree[elementTitle] = {};
		this.tree[elementTitle][parentTitle] = elementObject;
	}
	var self = this;
	$.each(elementObject.elements, function() {
		self.build(this.name, this, elementObject.name);
	});
};
