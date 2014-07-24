$.widget( "custom.xml_autocomplete", $.ui.autocomplete, {

	_create: function() {
		this._super();
		this.menu.element.addClass("xml_autocomplete");
	},

	_resizeMenu: function() {
		var matchWidth = this.options.matchSize.outerWidth();
		this.menu.element.outerWidth(matchWidth);
	},

	_renderMenu: function( ul, items ) {
		var self = this;
		var validItemFunction = this.options.validItemFunction;

		// Sort suggestions by proximity of search term to the beginning of the item
		var rankMap = [];
		$.each(items, function(index, item) {
			if (validItemFunction && validItemFunction(item.value))
				return true;
			rankMap.push([item.value.toLowerCase().indexOf(self.term.toLowerCase()), item]);
		});

		if (rankMap.length == 0) {
			this.close();
			return;
		}

		rankMap.sort(function(a, b) {
			return a[0] - b[0];
		});

		$.each(rankMap, function(index, item) {
			self._renderItemData(ul, item[1]);
		});
	},

	_renderItem : function(ul, item) {
		var re = new RegExp("((" + this.term + ")+)");
		var label = item.label.replace(re, "<span>$1</span>");
		return $("<li></li>")
			.data("item.autocomplete", item)
			.append("<a>" + label + "</a>")
			.appendTo(ul);
	},

	_move: function( direction, event ) {
		this._super(direction, event);
		this._resizeMenu();
	}
});