function XMLAttributeStub(xmlElement, editor) {
	this.objectType = {
		attrStub : true
	};
	this.editor = editor;
	this.guiEditor = this.editor.guiEditor;
	// dom element header for this element
	this.elementHeader = null;
	this.tagName = "";

	this.xmlElement = xmlElement;

	this.nameInput = null;
}

XMLAttributeStub.prototype.render = function() {
	this.domNodeID = "attr_stub_" + this.guiEditor.nextIndex();
	
	this.domNode = $("<div/>").attr({
		'id' : this.domNodeID + "_cont",
		'class' : attributeContainerClass + " xml_attr_stub"
	}).data('xmlAttribute', this).appendTo(this.xmlElement.getAttributeContainer());
	
	var self = this;
	var removeButton = document.createElement('a');
	removeButton.appendChild(document.createTextNode('(x) '));
	this.domNode[0].appendChild(removeButton);
	
	this.nameInput = document.createElement('label');
	this.nameInput.className = "edit_title";
	this.nameInput.setAttribute("contenteditable", "true");
	this.domNode[0].appendChild(this.nameInput);
	this.nameInput = $(this.nameInput);

	var createLink = $("<span class='create_attr'>create attribute</span>").appendTo(this.domNode).mouseup(function(e){
		self.create();
	});

	stubNameInput.call(this, this.nameInput, this.xmlElement.objectType.attributes,
		$.proxy(this.xmlElement.attributeExists, this.xmlElement));
	
	return this.domNode;
};

XMLAttributeStub.prototype.remove = function() {
	this.domNode.remove();
};

XMLAttributeStub.prototype.create = function() {
	var attrName = this.nameInput.text();
	var newAttr = this.editor.addAttribute(this.xmlElement, attrName);

	if (newAttr instanceof AbstractXMLObject) {
		this.remove();
	} else {
		console.log(newAttr);
	}
};

XMLAttributeStub.prototype.select = function() {
	this.domNode.addClass("selected");
};

XMLAttributeStub.prototype.deselect = function() {
	this.domNode.removeClass('selected');
};

XMLAttributeStub.prototype.isSelected = function() {
	return this.domNode.hasClass("selected");
};

XMLAttributeStub.prototype.focus = function() {
	this.nameInput.focus();
};
