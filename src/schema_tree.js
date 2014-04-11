/**
 * Unpacks the elements of the schema object into structures to accomodate lookup
 * of definitions by name and position within the schema hierarchy.
 */
function SchemaTree(rootElement) {
	// Map of elements stored by name.  If there are name collisions, then elements are stored in a list
	this.nameToDef = {};
	// Root of the schema tree
	this.rootElement = rootElement;
	// Store namespaces from the schema in a schema specific namespace list
	this.namespaceIndexes = this.rootElement.namespaces;
	this.namespaces = new NamespaceList();
	for (var index in this.namespaceIndexes) {
		var def = this.namespaceIndexes[index];
		this.namespaces.addNamespace(def.uri, def.prefix);
	}
}

// Recursively walk the provided schema to construct necessary representations of the tree for the editord
SchemaTree.prototype.build = function(elementName, elementDef, parentDef) {
	// Default to the root element if no element is given.
	if (arguments.length == 0) {
		elementName = this.rootElement.ns + ":" + this.rootElement.name;
		elementDef = this.rootElement;
		parentDef = null;
	}
	
	// Store a reference from this instance of an element back to the current parent.
	// These are needed to assist in disambiguating when multiple definitions share a name in a namespace
	if ("parents" in elementDef) {
		// Definition already has a parent, so add parent reference and return to avoid loop
		elementDef.parents.push(parentDef);
		return;
	} else {
		elementDef["parents"] = [parentDef];
	}
	
	var namespaceDefinition = this.namespaceIndexes[elementDef.ns];
	//Resolve namespace index into actual namespace uri
	elementDef.namespace = namespaceDefinition.uri;
	// Split element name into localName and prefixed name
	if (!elementDef.schema) {
		elementDef.localName = elementDef.name;
		elementDef.name = (namespaceDefinition.prefix? namespaceDefinition.prefix + ":" : "") + elementDef.localName;
	}
	
	// Add this definition to the map of elements.  If there is a name collision, store the 
	// elements with overlapping names together in a list
	var definitionList = this.nameToDef[elementName];
	if (definitionList == null) {
		this.nameToDef[elementName] = [elementDef];
	} else {
		this.nameToDef[elementName].push(elementDef);
	}
	
	var self = this;
	// Expand namespaces and names of attributes available to this element
	if (elementDef.attributes)
		$.each(elementDef.attributes, function() {
			if (this.localName)
				return true;
			this.localName = this.name;
			var namespaceDefinition = self.namespaceIndexes[this.ns];
			this.namespace = namespaceDefinition.uri;
			this.name = (namespaceDefinition.prefix? namespaceDefinition.prefix + ":" : "") + this.localName;
		});
	// Call build on all the child elements of this element to continue the walk.
	$.each(elementDef.elements, function() {
		self.build(this.ns + ":" + this.name, this, elementDef);
	});
};

// Retrieves the schema definition the provided element node.  If more than one definition is
// found for the element by name and namespace, then attempts to disambiguate by parents
SchemaTree.prototype.getElementDefinition = function(elementNode) {
	var namespaceIndex = 0;
	$.each(this.namespaceIndexes, function(){
		if (this.uri == elementNode.namespaceURI)
			return false;
		namespaceIndex++;
	});
	var prefixedName = namespaceIndex + ":" + localName(elementNode);
	var defList = this.nameToDef[prefixedName];
	if (defList == null)
		return null;
	if (defList.length == 1)
		return defList[0];
	
	for (index in defList) {
		if (this.pathMatches(elementNode, defList[index]))
			return defList[index];
	}
};

// Returns true if all the ancestors of the provided element match all the ancestors
// defined for this element in the schema
SchemaTree.prototype.pathMatches = function(elementNode, definition) {
	var isRootNode = elementNode.parentNode instanceof Document;
	var parentNode = elementNode.parentNode;
	for (index in definition.parents) {
		var parentDef = definition.parents[index];
		if (isRootNode) {
			// If this is a root node and the definition allows it, then we have a match
			if (definition.parents[index] == null || definition.parents[index].schema)
				return true;
		} else {
			if (parentDef.localName == localName(parentNode) && parentDef.namespace == parentNode.namespaceURI) {
				// Parent definitions matched, so continue the walk
				var answer = this.pathMatches(parentNode, parentDef);
				// If this particular parent definition matched all the way, then return true.
				if (answer)
					return true;
			}
		}
	}
	return false;
};