/**
 * Stores data representing a single attribute for an element
 */
function XMLAttribute(objectType, xmlElement, editor) {
	AbstractXMLObject.call(this, objectType, editor);
	// the XMLElement object which this attribute belongs to.
	this.xmlElement = xmlElement;

	this.attributeInput = null;
	// The menu button associated with this attribute.  Used for reenabling attribute in menu on remove
	// TODO replace this with a more general solution
	this.addButton = null;

	var prefix;
	this.attributeName = objectType.localName;
	// Determine whether the attribute name should include a namespace prefix
	if (this.xmlElement.objectType.namespace != this.objectType.namespace) {
		prefix = this.editor.xmlState.getNamespacePrefix(this.objectType.namespace);
		this.attributeName = prefix + this.attributeName;
	}
}

XMLAttribute.prototype.constructor = XMLAttribute;
XMLAttribute.prototype = Object.create( AbstractXMLObject.prototype );

// Render the gui representation of this attribute
XMLAttribute.prototype.render = function (){
	if (!this.xmlElement.domNode)
		return;

	this.domNodeID = this.xmlElement.domNodeID + "_" + this.objectType.ns + "_" + this.objectType.localName;
	
	this.domNode = $("<div/>").attr({
		'id' : this.domNodeID + "_cont",
		'class' : attributeContainerClass
	}).data('xmlAttribute', this).appendTo(this.xmlElement.getAttributeContainer());
	
	var self = this;
	var removeButton = document.createElement('a');
	removeButton.appendChild(document.createTextNode('(x) '));
	this.domNode[0].appendChild(removeButton);
	
	var label = document.createElement('label');
	var prefix = this.editor.xmlState.namespaces.getNamespacePrefix(this.objectType.namespace);
	label.appendChild(document.createTextNode(prefix + this.objectType.localName));
	this.domNode[0].appendChild(label);
	
	var attributeValue = this.xmlElement.xmlNode.attr(this.attributeName);
	if (attributeValue == '' && this.objectType.defaultValue != null) {
		attributeValue = this.objectType.defaultValue;
	}
	
	this.attributeInput = this.createElementInput(this.domNodeID.replace(":", "-"), attributeValue, this.domNode[0]);
	this.attributeInput.data('xmlAttribute', this);
	
	return this.attributeInput;
};

XMLAttribute.prototype.remove = function() {
	// Tell the button associated with this attribute that it was removed.  Replace this
	if ($("#" + this.domNodeID).length > 0) {
		if (this.addButton != null){
			this.addButton.removeClass("disabled");
		}
	}
	this.xmlElement.removeAttribute(this.objectType);
	this.domNode.remove();
};

// Synchronize this attributes value from the gui input back to the xml document
XMLAttribute.prototype.syncValue = function() {
	this.xmlElement.xmlNode.attr(this.attributeName, this.attributeInput.val());
};

// Change the attribute's value in the xml document to value
XMLAttribute.prototype.changeValue = function(value) {
	this.xmlElement.xmlNode.attr(this.attributeName, value);
};

XMLAttribute.prototype.select = function() {
	this.editor.guiEditor.selectNode(this.xmlElement);
	this.domNode.addClass("selected");
	this.attributeInput.focus();
};

XMLAttribute.prototype.deselect = function() {
	this.domNode.removeClass('selected');
};
