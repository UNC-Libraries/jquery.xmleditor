/**
 * Menu object for adding new elements to an existing element or document
 * @param menuID
 * @param label
 * @param expanded
 * @param enabled
 * @returns
 */
function ModifyElementMenu(menuID, label, expanded, enabled, owner) {
	this.menuID = menuID;
	this.label = label;
	this.menuHeader = null;
	this.menuContent = null;
	this.enabled = enabled;
	this.expanded = expanded;
	this.target = null;
	this.owner = owner;
}

ModifyElementMenu.prototype.destroy = function() {
	if (this.menuHeader != null)
		this.menuHeader.remove();
	if (this.menuContent != null)
		this.menuContent.remove();
};

ModifyElementMenu.prototype.render = function(parentContainer) {
	this.menuHeader = $("<div class='" + menuHeaderClass + "'/>").appendTo(parentContainer);
	if (this.expanded) {
		this.menuHeader.html(this.label + " <span>&#9660;</span>");
	} else {
		this.menuHeader.html(this.label + " <span>&#9654;</span>");
	}
	
	if (!this.enabled)
		this.menuHeader.addClass("disabled");
	
	this.menuContent = $("<ul id='" + this.menuID + "' class='" + menuContentClass + "'/>").data('menuData', this).appendTo(parentContainer);
	var self = this;
	this.menuHeader.click(function(){
		if (!self.enabled) {
			return;
		}
		
		if (self.expanded) {
			self.menuContent.animate({height: 'hide'}, menuExpandDuration, null, function(){
				self.menuContent.hide();
			});
			self.menuHeader.html(self.label + " <span>&#9654;</span>");
			self.expanded = false;
		} else {
			self.menuContent.show();
			self.menuContent.animate({height: 'show'}, menuExpandDuration);
			self.menuHeader.html(self.label + " <span>&#9660;</span>");
			self.expanded = true;
		}
	});
	return this;
};

ModifyElementMenu.prototype.initEventHandlers = function() {
	var self = this;
	this.menuContent.on('click', 'li', function(event){
		self.owner.editor.addChildElementCallback(this);
	});
};

ModifyElementMenu.prototype.clear = function() {
	var startingHeight = this.menuContent.height();
	this.menuContent.empty();
	this.menuContent.css({height: startingHeight + "px"}).stop().animate({height: "0px"}, menuExpandDuration);
	this.target = null;
	this.enabled = false;
	this.menuHeader.addClass('disabled');
	return this;
};

ModifyElementMenu.prototype.populate = function(xmlElement) {
	if (xmlElement == null || (this.target != null && xmlElement.guiElement != null 
			&& this.target[0] === xmlElement.guiElement[0]))
		return;
	
	if (this.expanded)
		this.menuContent.css("height", "auto");
	var startingHeight = this.menuContent.outerHeight();
	this.menuContent.empty();
	
	this.target = xmlElement;
	var self = this;
	var parent = this.target;
	var choiceList = parent.objectType.choices;
	
	$.each(this.target.objectType.elements, function(){
		var xmlElement = this;
		var addButton = $("<li/>").attr({
			title : 'Add ' + xmlElement.name
		}).html(xmlElement.name)
		.data('xml', {
				"target": self.target,
				"objectType": xmlElement
		}).appendTo(self.menuContent);
		// Disable the entry if its parent won't allow any more of this element type.
		if (!parent.childCanBeAdded(xmlElement))
			addButton.addClass('disabled');
	});
	if (this.expanded) {
		var endingHeight = this.menuContent.outerHeight() + 1;
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
