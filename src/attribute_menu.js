function AttributeMenu(menuID, label, expanded, enabled, owner) {
	ModifyElementMenu.call(this, menuID, label, expanded, enabled, owner);
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
	if (xmlElement == null || (this.target != null && xmlElement.guiElement != null 
			&& this.target[0] === xmlElement.guiElement[0]))
		return;
	
	if (this.expanded)
		this.menuContent.css("height", "auto");
	var startingHeight = this.menuContent.outerHeight();
	this.menuContent.empty();
	
	this.target = xmlElement;
	
	var attributesArray = this.target.objectType.attributes;
	var attributesPresent = {};
	$(this.target.xmlNode[0].attributes).each(function() {
		var targetAttribute = this;
		$.each(attributesArray, function(){
			if (this.name == targetAttribute.nodeName) {
				attributesPresent[this.name] = $("#" + xmlElement.guiElementID + "_" + targetAttribute.nodeName.replace(':', '-'));
			}
		});
	});
	
	var self = this;
	$.each(this.target.objectType.attributes, function(){
		var attribute = this;
		var addButton = $("<li/>").attr({
				title : 'Add ' + attribute.name,
				'id' : xmlElement.guiElementID + "_" + attribute.nameEsc + "_add"
			}).html(attribute.name)
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
