function AttributeMenu(menuID, label, expanded, enabled, owner, editor) {
	ModifyElementMenu.call(this, menuID, label, expanded, enabled, owner, editor);
}

AttributeMenu.prototype.constructor = AttributeMenu;
AttributeMenu.prototype = Object.create( ModifyElementMenu.prototype );

AttributeMenu.prototype.initEventHandlers = function() {
	var self = this;
	this.menuContent.on('click', 'li', function(event){
		self.owner.editor.addAttributeButtonCallback(this);
	});
};

AttributeMenu.prototype.populate = function (xmlElement) {
	if (xmlElement == null || (this.target != null && xmlElement.domNode != null 
			&& this.target[0] === xmlElement.domNode[0]))
		return;
	
	if (this.expanded)
		this.menuContent.css("height", "auto");
	var startingHeight = this.menuContent.outerHeight();
	this.menuContent.empty();
	
	this.target = xmlElement;
	
	var attributesArray = this.target.objectType.attributes;
	if (attributesArray) {
		var attributesPresent = {};
		$(this.target.xmlNode[0].attributes).each(function() {
			var targetAttribute = this;
			$.each(attributesArray, function(){
				if (this.name == targetAttribute.nodeName) {
					attributesPresent[this.name] = $("#" + xmlElement.domNodeID + "_" + targetAttribute.nodeName.replace(':', '-'));
				}
			});
		});
		
		var self = this;
		$.each(this.target.objectType.attributes, function(){
			var attribute = this;
			// Using prefix according to the xml document namespace prefixes
			var nsPrefix = self.editor.xmlState.namespaces.getNamespacePrefix(attribute.namespace);
			// Namespace not present in XML, so use prefix from schema
			if (nsPrefix === undefined)
				nsPrefix = self.editor.schemaTree.namespaces.getNamespacePrefix(attribute.namespace);
				
			var attrName = nsPrefix + attribute.localName;
			var addButton = $("<li/>").attr({
					title : 'Add ' + attrName,
					'id' : xmlElement.domNodeID + "_" + attrName.replace(":", "_") + "_add"
				}).html(attrName)
				.data('xml', {
					"objectType": attribute,
					"target": xmlElement
				}).appendTo(self.menuContent);
			
			if (attribute.name in attributesPresent) {
				addButton.addClass("disabled");
				if (attributesPresent[attribute.name].length > 0)
					attributesPresent[attribute.name].data('xmlAttribute').addButton = addButton;
			}
		});
	}
		
	if (this.expanded) {
		var endingHeight = this.menuContent.outerHeight();
		if (endingHeight == 0)
			endingHeight = 1;
		this.menuContent.css({height: startingHeight + "px"}).stop().animate({height: endingHeight + "px"}, menuExpandDuration).show();
	}
	
	if (this.menuContent.children().length == 0) {
		this.menuHeader.addClass("disabled");
		this.enabled = false;
	} else {
		this.menuHeader.removeClass("disabled");
		this.enabled = true;
	}
	
	return this;
};
