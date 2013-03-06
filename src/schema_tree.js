/**
 * Stores a traversible tree of element types
 * @param rootElement
 */
function SchemaTree(rootElement) {
	this.tree = {};
	this.rootElement = rootElement;
	this.namespaces = new NamespaceList();
}

SchemaTree.prototype.build = function(elementTitle, elementObject, parentTitle) {
	// Default to the root element if no element is given.
	if (arguments.length == 0) {
		elementTitle = this.rootElement.name;
		elementObject = this.rootElement;
		parentTitle = "";
	}
	// Collect the list of namespaces in use in this schema
	var namespace = elementObject.namespace;
	if (!(namespace in this.namespaceToPrefix)) {
		var nameParts = elementObject.name.split(":");
		var prefix = (nameParts.length == 1)? "" : nameParts[0];
		this.namespaces.addNamespace(namespace, prefix);
	}
	
	// Establish the link from the parent to this element.
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
	// Call build on all the child elements of this element.
	var self = this;
	$.each(elementObject.elements, function() {
		self.build(this.name, this, elementObject.name);
	});
};
