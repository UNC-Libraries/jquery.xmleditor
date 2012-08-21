/*

    Copyright 2008 The University of North Carolina at Chapel Hill

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

            http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

 */
/*
 * jQuery MODS Editor
 * 
 * Dependencies:
 *   vkbeautify.0.98.01.beta.js
 *   jquery 1.7.1
 *   jquery.ui 1.7.1
 *   ajax ace editor
 *   jquery.xmlns.js
 *   expanding.js
 * 
 * @author Ben Pennell
 */
;
(function($) {
	$.fn.extend({
		modsEditor : function(schema, options) {
			return this.each(function() {
				new $.ModsEditor(this, schema, options);
			});
		}
	});
	
	var modsNS = "http://www.loc.gov/mods/v3";

	$.ModsEditor = function(target, schemaIn, options) {
		defaults = {
			elementRootPrefix : "root_element_",
			elementPrefix : "mods_element_",
			childrenContainerSelector : " > .mods_children",
			childrenContainerClass : "mods_children",
			attributesContainerSelector : " > .mods_attrs",
			attributesContainerClass : "mods_attrs",
			modsEditorContainerId: "mods_editor_container",
			modsWorkAreaContainerId: "mods_work_area",
			modsContentId : "mods_content",
			
			menuColumnId : "mods_menu_column",
			menuContainerClass : "mods_menu_container",
			menuHeaderClass : "menu_header",
			menuContentClass : 'menu_content',
			menuExpandDuration : 180,
			
			addTopMenuHeaderText : 'Add Top Element',
			addTopMenuId : "add_top_menu",
			addAttrMenuHeaderText : 'Add Attribute',
			addAttrMenuId : "add_attribute_menu",
			addElementMenuHeaderText : 'Add Subelement',
			addElementMenuId : "add_element_menu",
			
			modsMenuBarId : "mods_menu_bar",
			modsMenuHeaderPrefix : "mods_header_item_",
			
			submitButtonId : "send_xml",
			
			modsElementClass : 'mods_element',
			topLevelContainerClass : 'top_level_element_group',
			xmlTabId : "mods_xml_content_tab",
			xmlTabLabel : "XML",
			submissionStatusId : "mods_submit_status",
			
			confirmExitWhenUnsubmitted : true,
			enableGUIKeybindings : true,
			floatingMenu : true,
			enableMenuBar : true,
			
			ajaxOptions : {
				modsUploadPath: null,
				modsRetrievalPath: null,
				modsRetrievalParams : null
			},
			localXMLContentSelector: target,
			prettyXML : true,
			undoHistorySize: 20,
			documentTitle : null,
			nameSpaces: {
				"mods" : "http://www.loc.gov/mods/v3"
			}
		};
		
		options = $.extend({}, defaults, options);
		
		var schema = schemaIn;
		
		// Add namespaces into jquery
		$.each(options.nameSpaces, function (prefix, value) {
			$.xmlns[prefix] = value;
		});
		
		// Tree of MODS element types
		var modsTree = null;
		// State of the XML document
		var xmlState = null;
		// Container for the entire editor
		var modsEditorContainer = null;
		// Container for the subeditors
		var modsWorkAreaContainer = null;
		// Tabbed container for differentiating between specific subeditors
		var modsTabContainer = null;
		// GUI editor container
		var guiContent = null;
		// Text/xml editor container
		var xmlContent = null;
		// Header container for the menu and top level info
		var editorHeader = null;
		// Panel for displaying errors
		var problemsPanel = null;
		// GUI Editor object
		var guiEditor = null;
		// Text Editor object
		var textEditor = null;
		// Currently active editor
		var activeEditor = null;
		// History manager for undo/redo
		var undoHistory = null;
		// Top level menu bar object
		var menuBar = null;
		// Element modification object
		var modifyMenu = null;
		
		/**
		 * Start setting up the editor.
		 */
		function initializeEditor() {
			modsTree = new SchemaTree(schema);
			modsTree.build();
			
			// Retrieve the local mods content before we start populating the editor.
			var localXMLContent = $(options.localXMLContentSelector).html();
			$(target).empty();
			
			xmlState = null;
			
			modsEditorContainer = $("<div/>").attr('id', options.modsEditorContainerId).appendTo(target);
			modsWorkAreaContainer = null;
			modsTabContainer = null;
			guiContent = null;
			xmlContent = null;
			
			editorHeader = null;
			problemsPanel = null;
			
			guiEditor = new GUIEditor();
			textEditor = new TextEditor();
			activeEditor = guiEditor;
			
			undoHistory = new UndoHistory();
			undoHistory.setStateChangeEvent(function() {
				refreshDisplay();
			});

			menuBar = new MenuBar();
			menuBar.updateFunctions.push(refreshMenuUndo);
			menuBar.updateFunctions.push(refreshMenuSelected);
			modifyMenu = new ModifyMenuPanel();
			
			if (options.enableGUIKeybindings)
				$(window).keydown(keydownCallback);
			if (options.confirmExitWhenUnsubmitted) {
				$(window).bind('beforeunload', function(e) {
					if (xmlState.isChanged()) {
						return "The document contains unsaved changes.";
					}
				});
			}
			
			if (options.ajaxOptions.modsRetrievalPath != null) {
				$.ajax({
					type : "GET",
					url : options.ajaxOptions.modsRetrievalPath,
					data : (options.ajaxOptions.modsRetrievalParams),
					dataType : "text",
					success : function(data) {
						setupEditor(data);
					}
				});
			} else {
				setupEditor(localXMLContent);
			}
		}
		
		function setupEditor(xmlString) {
			xmlState = new DocumentState(xmlString);
			constructEditor();
			refreshDisplay();
			// Capture baseline undo state
			undoHistory.captureSnapshot();
		}
		
		function constructEditor() {
			// Work Area
			modsWorkAreaContainer = $("<div/>").attr('id', options.modsWorkAreaContainerId).appendTo(modsEditorContainer);
			
			// Menu bar
			editorHeader = $("<div/>").attr('id', 'mods_editor_header').appendTo(modsWorkAreaContainer);
			if (options.documentTitle != null)
				$("<h2/>").html("Editing Description: " + options.documentTitle).appendTo(editorHeader);
			menuBar.render(editorHeader);
			
			modsTabContainer = $("<div/>").attr("id", "mods_tab_area").css("padding-top", editorHeader.height() + "px").appendTo(modsWorkAreaContainer);
			problemsPanel = $("<pre/>").attr('id', 'mods_problems_panel').hide().appendTo(modsTabContainer);
			
			var modeTabs = $("<ul/>").appendTo(modsTabContainer);
			modeTabs.append("<li><a href='#gui_content'>MODS</a></li>");
			modeTabs.append("<li><a href='#xml_content' id='" + options.xmlTabId + "'>XML</a></li>");
			
			guiContent = $("<div/>").attr('id', 'gui_content').appendTo(modsTabContainer);
			xmlContent = $("<div/>").attr('id', 'xml_content').appendTo(modsTabContainer);
			
			modsTabContainer.tabs({
				show: modeChange,
				select: modeTabSelect
			});
			
			if (options.enableMenuBar) {
				modeTabs.css("display", "none");
			}
			
			guiEditor.initialize(guiContent);
			
			$(window).resize(function() {
				selected = modsTabContainer.tabs('option', 'selected');
				modsTabContainer.width(modsEditorContainer.outerWidth() - modifyMenu.menuColumn.outerWidth());
				if (activeEditor != null){
					activeEditor.resize();
				}
				editorHeader.width(modsTabContainer.width());
				if (options.floatingMenu) {
					modifyMenu.setMenuPosition();
				}
			});
			
			modifyMenu.initialize(modsEditorContainer);
			modifyMenu.addMenu(options.addElementMenuId, options.addElementMenuHeaderText, 
					true, false, true);
			modifyMenu.addAttributeMenu(options.addAttrMenuId, options.addAttrMenuHeaderText, 
					true, false, true);
			modifyMenu.addMenu(options.addTopMenuId, options.addTopMenuHeaderText, 
					true, true).populate(guiEditor.rootElement, schema);
			
			if (options.floatingMenu) {
				$(window).scroll(modifyMenu.setMenuPosition);
			}
			
			$("#" + options.submitButtonId).click(function() {
				saveXML();
			});
			$(window).resize();
		}
		
		function focusElement(focusTarget) {
			if (!isCompletelyOnScreen(focusTarget)){
				var scrollHeight = focusTarget.offset().top + (focusTarget.height()/2) - ($(window).height()/2);
				if (scrollHeight > focusTarget.offset().top)
					scrollHeight = focusTarget.offset().top;
				scrollHeight -= editorHeader.height();
				$("html, body").stop().animate({ scrollTop: scrollHeight }, 500);
			}
		}
		
		function isCompletelyOnScreen(object) {
			var objectTop = object.offset().top;
			var objectBottom = objectTop + object.height();
			var docViewTop = $(window).scrollTop() + editorHeader.height();
		    var docViewBottom = docViewTop + $(window).height() - editorHeader.height();
		    
		    return (docViewTop < objectTop) && (docViewBottom > objectBottom);
		}
		
		function addChildElementCallback() {
			var xmlElement = $(this).data("mods").target;
			var elementType = $(this).data("mods").elementType;
			
			if (textEditor.active) {
				// Refresh xml state
				if (xmlState.changesNotSynced()) {
					try {
						setXMLFromEditor();
					} catch (e) {
						addProblem("Unable to add element, please fix existing XML syntax first.", e);
						return;
					}
				}
			}
			
			var newElement = xmlElement.addElement(elementType);
			
			activeEditor.addElementEvent(xmlElement, newElement);
			xmlState.documentChangedEvent();
		}
		
		function addAttributeButtonCallback() {
			if ($(this).hasClass("disabled"))
				return;
			if (xmlState.changesNotSynced()) {
				try {
					setXMLFromEditor();
				} catch (e) {
					alert(e.message);
					return;
				}
			}
			var data = $(this).data('mods');
			data.target.addAttribute(data.attributeType);
			
			activeEditor.addAttributeEvent(data.target, data.attributeType, $(this));
		}
		
		function modeTabSelect(event, ui) {
			if (ui.index == 0) {
				if (textEditor.isInitialized() && xmlState.isChanged()) {
					// Try to reconstruct the xml object before changing tabs.  Cancel change if parse error to avoid losing changes.
					try {
						setXMLFromEditor();
					} catch (e) {
						addProblem("Invalid xml", e);
						return false;
					}
					undoHistory.captureSnapshot();
				}
			}
		}
		
		function modeChange(event, ui) {
			$(".active_mode_tab").removeClass("active_mode_tab");
			modifyMenu.clearContextualMenus();
			if (activeEditor != null) {
				activeEditor.deactivate();
			}
			if (ui.index == 0) {
				activeEditor = guiEditor;
				$("#" + options.modsMenuHeaderPrefix + "MODS").addClass("active_mode_tab");
			} else {
				activeEditor = textEditor;
				$("#" + options.modsMenuHeaderPrefix + "XML").addClass("active_mode_tab");
			}
			activeEditor.activate();
		}
		
		function refreshDisplay() {
			if (activeEditor == null)
				return;
			activeEditor.refreshDisplay();
			
			if (options.floatingMenu) {
				modifyMenu.setMenuPosition();
			}
			modsWorkAreaContainer.width(modsEditorContainer.outerWidth() - modifyMenu.menuColumn.outerWidth());
		}
		
		function setXMLFromEditor() {
			var xmlString = textEditor.editor.getValue();
			xmlState.setXMLFromString(xmlString);
		}
		
		function saveXML() {
			if (options.ajaxOptions.modsUploadPath != null) {
				submitXML();
			} else {
				// Implement later when there is more browser support for html5 File API
				exportXML();
			}
		}
		
		function getBlobBuilder() {
			return window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder;
		}
		
		function exportXML() {
			window.URL = window.webkitURL || window.URL;
			window.BlobBuilder = getBlobBuilder();
			
			if (window.BlobBuilder === undefined) {
				addProblem("Browser does not support saving files via this editor.  To save, copy and paste the document from the XML view.");
				return false;
			}
			
			if (textEditor.active) {
				try {
					setXMLFromEditor();
				} catch (e) {
					xmlState.setDocumentHasChanged(true);
					$("#" + options.submissionStatusId).html("Failed to save<br/>See errors at top").css("background-color", "#ffbbbb").animate({backgroundColor: "#ffffff"}, 1000);
					addProblem("Cannot save due to invalid xml", e);
					return false;
				}
			}
			
			var xmlString = xml2Str(xmlState.xml);
			var blobBuilder = new BlobBuilder();
			blobBuilder.append(xmlString);
			
			var mimeType = "text/xml";
			
			var a = document.createElement('a');
			a.download = "mods.xml";
			a.href = window.URL.createObjectURL(blobBuilder.getBlob(mimeType));
			
			a.dataset.downloadurl = [mimeType, a.download, a.href].join(':');
			a.target = "exportMODS";
			
			var event = document.createEvent("MouseEvents");
			event.initMouseEvent(
				"click", true, false, window, 0, 0, 0, 0, 0
				, false, false, false, false, 0, null
			);
			a.dispatchEvent(event);
		}

		function submitXML() {
			if (textEditor.active) {
				try {
					setXMLFromEditor();
				} catch (e) {
					xmlState.setDocumentHasChanged(true);
					$("#" + options.submissionStatusId).html("Failed to submit<br/>See errors at top").css("background-color", "#ffbbbb").animate({backgroundColor: "#ffffff"}, 1000);
					addProblem("Cannot submit due to invalid xml", e);
					return false;
				}
			}
			
			// convert XML DOM to string
			var xmlString = xml2Str(xmlState.xml);

			$("#" + options.submissionStatusId).html("Submitting...");
			
			$.ajax({
				'url' : options.ajaxOptions.modsUploadPath,
				'contentType' : "application/xml",
				'type' : "POST",
				'data' : xmlString,
				success : function(response) {
					var responseObject = $(response);
					if (responseObject.length > 0 && responseObject[responseObject.length - 1].localName == "sword:error") {
						xmlState.changeEvent();
						$("#" + options.submissionStatusId).html("Failed to submit<br/>See errors at top").css("background-color", "#ffbbbb").animate({backgroundColor: "#ffffff"}, 1000);
						addProblem("Failed to submit MODS document", responseObject.find("atom\\:summary").html());
						return;
					}
					
					xmlState.changesCommittedEvent();
					clearProblemPanel();
				},
				error : function(jqXHR, exception) {
					if (jqXHR.status === 0) {
						alert('Not connect.\n Verify Network.');
					} else if (jqXHR.status == 404) {
						alert('Requested page not found. [404]');
					} else if (jqXHR.status == 500) {
						alert('Internal Server Error [500].');
					} else if (exception === 'parsererror') {
						alert('Requested JSON parse failed.');
					} else if (exception === 'timeout') {
						alert('Time out error.');
					} else if (exception === 'abort') {
						alert('Ajax request aborted.');
					} else {
						alert('Uncaught Error.\n' + jqXHR.responseText);
					}
				}
			});
		}

		// convert xml DOM to string
		function xml2Str(xmlNodeObject) {
			if (xmlNodeObject == null)
				return;
			var xmlNode = (xmlNodeObject instanceof jQuery? xmlNodeObject[0]: xmlNodeObject);
			var xmlStr = "";
			try {
				// Gecko-based browsers, Safari, Opera.
				xmlStr = (new XMLSerializer()).serializeToString(xmlNode);
			} catch (e) {
				try {
					// Internet Explorer.
					xmlStr = xmlNode.xml;
				} catch (e) {
					addProblem('Xmlserializer not supported', e);
					return false;
				}
			}
			xmlStr = vkbeautify.xml(xmlStr);
			return xmlStr;
		}
				
		function createElementInput(elementType, inputID, startingValue, appendTarget) {
			var input = null;
			if (elementType.values.length > 0){
				var selectionValues = elementType.values;
				input = $('<select />').attr({
					'id' : inputID
				}).appendTo(appendTarget);

				$.each(selectionValues, function() {
					$('<option />', {
						value : this,
						text : this.toString(),
						selected : (startingValue == this)
					}).appendTo(input);
				});
			} else if (elementType.type == 'date' || (elementType.attribute && elementType.type == 'string')){
				input = $('<input/>').attr({
					'id' : inputID,
					'type' : 'text',
					'value' : startingValue
				}).appendTo(appendTarget).one('focus', function() {
					if ($(this).val() == " ") {
						$(this).val("");
					}
				});
			} else if (elementType.element && elementType.type == 'string'){
				input = $('<textarea/>').attr({
					'id' : inputID,
					'value' : startingValue
				}).appendTo(appendTarget).one('focus', function() {
					if ($(this).val() == " ") {
						$(this).val("");
					}
				}).expandingTextarea();
			}
			return input;
		}
		
		function getParentObject(object, suffix) {
			var objectId = $(object).attr('id');
			var parentId = objectId.substring(0, objectId.indexOf(suffix));
			
			var parentObject = $("#" + parentId);
			if (parentObject.length == 0)
				return;
			
			return parentObject;
		}
		
		function addProblem(message, problem) {
			problemsPanel.html(message + "<br/>");
			if (problem !== undefined) {
				if (problem.substring) {
					problemsPanel.append(problem.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
				} else {
					problemsPanel.append(problem.message.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
				}
			}
			refreshProblemPanel();
		}
		
		function clearProblemPanel() {
			problemsPanel.hide();
		}
		
		function refreshProblemPanel() {
			if (problemsPanel.html() == "") {
				problemsPanel.hide("fast");
			} else {
				problemsPanel.show("fast");
			}
		}

		function modsEquals(node, element) {
			return (((element.substring && element == node.localName) || (!element.substring && element.name == node.localName)) 
					&& node.namespaceURI == "http://www.loc.gov/mods/v3");
		}

		function tagOccurrences(string, tagTitle) {
			if (string == null || tagTitle == null)
				return 0;
			var matches = string.match(new RegExp("<" + tagTitle + "( |>|$)", "g"));
			return matches ? matches.length : 0;
		}
		
		function getXPath(element) {
		    var xpath = '';
		    for ( ; element && element.nodeType == 1; element = element.parentNode ) {
		        var id = $(element.parentNode).children(element.tagName.replace(":", "\\:")).index(element) + 1;
		        id = ('[' + id + ']');
		        if (element.tagName.indexOf("mods:") == -1)
		        	xpath = '/mods:' + element.tagName + id + xpath;
		        else xpath = '/' + element.tagName + id + xpath;
		    }
		    return xpath;
		}
					
		function keydownCallback(e) {
			if (guiEditor.active) {
				var focused = $("input:focus, textarea:focus, select:focus");
				
				// Escape key, blur the currently selected input or deselect selected element
				if (e.keyCode == 27) {
					if (focused.length > 0)
						focused.blur();
					else guiEditor.selectElement(null);
					return false;
				}
				
				// Enter, focus the first visible input
				if (e.keyCode == 13 && focused.length == 0) {
					guiEditor.focusSelectedFirstInput();
					return false;
				}
				
				// Tab, select the next input
				if (e.keyCode == 9) {
					guiEditor.focusInput(e.shiftKey);
					return false;
				}
				
				// Delete key press while item selected but nothing is focused.
				if (e.keyCode == 46 && focused.length == 0) {
					guiEditor.deleteSelected();
					return false;
				}
				
				if (e.keyCode > 36 && e.keyCode < 41 && focused.length == 0){
					if (e.altKey) {
						// Alt + up or down move the element up and down in the document
						guiEditor.moveSelected(e.keyCode == 38);
					} else if (e.shiftKey) {
						// If holding shift while pressing up or down, then jump to the next/prev sibling
						if (e.keyCode == 40 || e.keyCode == 38) {
							guiEditor.selectSibling(e.keyCode == 38);
						} else if (e.keyCode == 37 || e.keyCode == 39) {
							guiEditor.selectParent(e.keyCode == 39);
						}
					} else {
						// If not holding shift while hitting up or down, go to the next/prev element
						if (e.keyCode == 40 || e.keyCode == 38){
							guiEditor.selectNext(e.keyCode == 38);
						} else if (e.keyCode == 39 || e.keyCode == 37) {
							guiEditor.changeSelectedTab(e.keyCode == 37);
						}
					}
					return false;
				}
				
				if ((e.metaKey || e.ctrlKey) && focused.length == 0 && e.keyCode == 'Z'.charCodeAt(0)) {
					// Undo
					undoHistory.changeHead(e.shiftKey? 1: -1);
					return false;
				} else if ((e.metaKey || e.ctrlKey) && focused.length == 0 && e.keyCode == 'Y'.charCodeAt(0)){
					// Redo
					undoHistory.changeHead(1);
					return false;
				}
			}
			
			// Save, on either tab.
			if (e.altKey && e.shiftKey && e.keyCode == 'S'.charCodeAt(0)) {
				$("#" + options.submitButtonId).click();
				return false;
			}
			
			if (e.altKey && e.shiftKey && e.keyCode == 'E'.charCodeAt(0)) {
				exportXML();
				return false;
			}
			
			if (e.altKey && e.shiftKey && e.keyCode == 'M'.charCodeAt(0)) {
				modsTabContainer.tabs('select', 0);
				return false;
			}
			
			if (e.altKey && e.shiftKey && e.keyCode == 'X'.charCodeAt(0)) {
				modsTabContainer.tabs('select', 1);
				return false;
			}
			
			return true;
		}
		
		/**
		 * Menu Update functions
		 */
		function refreshMenuUndo() {
			if (undoHistory.headIndex > 0) {
				$("#" + options.modsMenuHeaderPrefix + "Undo").removeClass("disabled").data("menuItemData").enabled = true;
			} else {
				$("#" + options.modsMenuHeaderPrefix + "Undo").addClass("disabled").data("menuItemData").enabled = false;
			}
			if (undoHistory.headIndex < undoHistory.states.length - 1) {
				$("#" + options.modsMenuHeaderPrefix + "Redo").removeClass("disabled").data("menuItemData").enabled = true;
			} else {
				$("#" + options.modsMenuHeaderPrefix + "Redo").addClass("disabled").data("menuItemData").enabled = false;
			}
		};
		
		function refreshMenuSelected() {
			var suffixes = ['Deselect', 'Next_Element', 'Previous_Element', 'Parent', 'First_Child', 'Next_Sibling', 
			                'Previous_Sibling', 'Next_Element_Tab', 'Previous_Element_Tab', 'Delete', 'Move_Element_Up', 
			                'Move_Element_Down'];
			var hasSelected = guiEditor.selectedElement != null && guiEditor.active;
			$.each(suffixes, function(){
				if (hasSelected)
					$("#" + options.modsMenuHeaderPrefix + this.toString()).removeClass("disabled").data("menuItemData").enabled = true;
				else $("#" + options.modsMenuHeaderPrefix + this.toString()).addClass("disabled").data("menuItemData").enabled = false;
			});
		}
		
		/**
		 * Stores data related to a single MODS element as it is represented in both the base XML 
		 * document and GUI
		 */
		function XMLElement(xmlNode, elementType) {
			this.xmlNode = $(xmlNode);
			this.elementType = elementType;
			this.isTopLevel = (this.xmlNode.parents().length == 1);
			this.allowChildren = elementType.elements.length > 0;
			this.allowAttributes = elementType.attributes.length > 0;
			this.allowText = elementType.type != 'none';
			this.guiElementID = null;
			this.guiElement = null;
			this.parentElement = null;
			this.textInput = null;
			this.tabs = {};
			this.elementHeader = null;
			this.childContainer = null;
		}
		
		XMLElement.prototype.render = function (parentElement, recursive) {
			this.parentElement = parentElement;
			this.guiElementID = options.elementPrefix + guiEditor.nextIndex();
			
			// Create the element and add it to the container
			this.guiElement = $('<div/>').attr({
				'id' : this.guiElementID,
				'class' : this.elementType.name + 'Instance mods_element'
			}).appendTo(this.parentElement.childContainer);
			if (this.isTopLevel) {
				this.guiElement.addClass(options.topLevelContainerClass);
			}
			
			this.guiElement.data("xmlElement", this);
			
			// Begin building contents
			this.elementHeader = $("<ul/>").attr({
				'class' : 'element_header'
			}).appendTo(this.guiElement);
			var elementNameContainer = $("<li class='element_name'/>").appendTo(this.elementHeader);

			// set up element title and entry field if appropriate
			$('<span/>').text(this.elementType.name).appendTo(elementNameContainer);

			// Tabs go in next
			this.addElementTabs(recursive);

			// Action buttons
			this.elementHeader.append(this.addTopActions(this.guiElementID));
			
			// Activate the tabs
			this.guiElement.tabs({
				select: function(){
					guiEditor.selectElement($(this));
				}
			});

			var thiz = this;
			this.guiElement.click(function(event) {
				guiEditor.selectElement(thiz);
				event.stopPropagation();
			});
			
			return this.guiElement;
		};
		
		XMLElement.prototype.renderChildren = function(recursive) {
			this.childCount = 0;
			this.guiElement.children("." + options.modsElementClass).remove();
			
			var elementsArray = this.elementType.elements;
			var thiz = this;
			this.xmlNode.children().each(function() {
				for ( var i = 0; i < elementsArray.length; i++) {
					if (modsEquals(this, elementsArray[i])) {
						var childElement = new XMLElement($(this), elementsArray[i]);
						childElement.render(thiz, recursive);
						childElement.initializeGUI();
					}
				}
			});
		};
		
		XMLElement.prototype.renderAttributes = function () {
			var thiz = this;
			var attributesArray = this.elementType.attributes;
			
			$(this.xmlNode[0].attributes).each(function() {
				for ( var i = 0; i < attributesArray.length; i++) {
					if (attributesArray[i].name == this.nodeName) {
						var attribute = new XMLAttribute(attributesArray[i], thiz);
						attribute.render();
					}
				}
			});
		};
		
		XMLElement.prototype.initializeGUI = function () {
			// Activate the tabs
			this.guiElement.tabs({
				select: function(){
					guiEditor.selectElement($(this));
				}
			});
			
			this.guiElement.find("." + options.modsElementClass).each(function(){
				$(this).tabs();
			});
		};
		
		XMLElement.prototype.addTopActions = function () {
			var topActionSpan = $("<li class='top_actions'/>");
			// create move up button and callback for element
			$('<input>').attr({
				'type' : 'button',
				'value' : '\u2193',
				'id' : this.guiElementID + '_down'
			}).appendTo(topActionSpan).click(function(){
				guiEditor.moveDownSelected();
			});

			// create move up button and callback for element
			$('<input>').attr({
				'type' : 'button',
				'value' : '\u2191',
				'id' : this.guiElementID + '_up'
			}).appendTo(topActionSpan).click(function(){
				guiEditor.moveUpSelected();
			});

			// create delete button and callback for element
			$('<input>').attr({
				'type' : 'button',
				'value' : 'X',
				'id' : this.guiElementID + '_del'
			}).appendTo(topActionSpan).click(function(){
				guiEditor.deleteSelected();
			});
			
			return topActionSpan;
		};

		XMLElement.prototype.addElementTabs = function (recursive) {
			var attributesArray = this.elementType.attributes;
			var elementsArray = this.elementType.elements;

			if (this.elementType.type != null) {
				this.addTextTab();
			}

			if (elementsArray.length > 0) {
				this.addSubelementTab(recursive);
			}

			if (attributesArray.length > 0) {
				this.addAttributeTab();
			}
		};
		
		XMLElement.prototype.addTextTab = function () {
			var tabID = "text";
			var tabContent = this.addElementTab(tabID, "Text").tabs[tabID].content;
			var textContainsChildren = this.xmlNode.children().length > 0;
			
			var textValue = "";
			if (textContainsChildren) {
				textValue = xml2Str(this.xmlNode.children());
			} else {
				textValue = this.xmlNode.text();
			}
			
			this.textInput = createElementInput(this.elementType, this.guiElementID + "_text", 
					textValue, tabContent);
			if (textContainsChildren)
				this.textInput.attr("disabled", "disabled");
			var thiz = this;
			this.textInput.change(function() {
				thiz.syncText();
				xmlState.documentChangedEvent();
			});
		};
		
		XMLElement.prototype.addSubelementTab = function (recursive) {
			var tabID = "elements";
			var tabData = this.addElementTab(tabID, "Subelements").tabs[tabID];
			var tabContent = tabData.content;
			tabContent.addClass(options.childrenContainerClass);
			this.childContainer = tabContent;
			
			$("<div/>").addClass("placeholder").html("Use the menu on the right to add subelements.").appendTo(tabContent);
			
			// Add all the subchildren
			if (recursive) {
				this.renderChildren(tabContent, true);
			}
			
			this.changeTabCount(tabID, this.xmlNode.children().length);
		};
		
		XMLElement.prototype.addAttributeTab = function () {
			var tabID = "attributes";
			var tabContent = this.addElementTab(tabID, "Attributes").tabs[tabID].content;
			tabContent.addClass(options.attributesContainerClass);
			
			$("<div/>").addClass("placeholder").html("Use the menu on the right to add attributes.").appendTo(tabContent);
			
			this.renderAttributes();
			
			this.changeTabCount(tabID, this.xmlNode[0].attributes.length);
		};

		XMLElement.prototype.addElementTab = function(tabID, label) {
			var tabContentID = this.guiElementID + "_tab_" + tabID;
			var tabEntry = $("<li/>");
			var tabLink = $("<a/>").attr("href", "#" + tabContentID).html(label).appendTo(tabEntry);
			this.elementHeader.append(tabEntry);
			var tabContent = $("<div/>").attr('id', tabContentID);
			this.guiElement.append(tabContent);
			this.tabs[tabID] = {
					'entry' : tabEntry,
					'content' : tabContent,
					'link' : tabLink,
					'label' : label,
					'count' : 0
				};
			return this;
		};
		
		XMLElement.prototype.addElement = function(elementType) {
			if (!this.allowChildren)
				return null;
			
			// Create the new element in a dummy document with the mods namespace
			// It will retain its namespace after attaching to the xml document regardless of mods ns prefix
			var newElement = $($.parseXML("<wrap xmlns:mods='" + modsNS + "'><mods:" + elementType.name + "/></wrap>")).find("*|wrap > *|*").clone();
			newElement.text(" ");
			this.xmlNode.append(newElement);
			
			var childElement = new XMLElement(newElement, elementType);
			this.childCount++;
			if (this.guiElement != null)
				childElement.render(this, true);
			
			return childElement;
		};
		
		XMLElement.prototype.syncText = function() {
			this.xmlNode.text(this.textInput.val());
		};
		
		XMLElement.prototype.childRemoved = function(child) {
			this.changeTabCount("elements", -1, true);
		};
		
		XMLElement.prototype.attributeRemoved = function(child) {
			this.changeTabCount("attributes", -1, true);
		};
		
		XMLElement.prototype.remove = function() {
			// Remove the element from the xml doc
			this.xmlNode.remove();
			
			if (this.guiElement != null) {
				this.guiElement.remove();
			}
			
			// Notify parent this object was removed
			if (this.parentElement != null) {
				this.parentElement.childRemoved(this);
			}
		};
		
		XMLElement.prototype.swap = function (swapTarget) {
			if (swapTarget == null) {
				return;
			}
			
			// Swap the xml nodes
			swapTarget.xmlNode.detach().insertAfter(this.xmlNode);
			if (swapTarget.guiElement != null && this.guiElement != null) {
				// Swap the gui nodes
				swapTarget.guiElement.detach().insertAfter(this.guiElement);
				
				// Some things, like tabs, need to be reinitialized
				swapTarget.initializeGUI();
				
				if (!isCompletelyOnScreen(this.guiElement)) {
					focusElement(this.guiElement);
				}
			}
			
			xmlState.documentChangedEvent();
		};
		
		XMLElement.prototype.moveUp = function() {
			var previousSibling = this.guiElement.prev("." + options.modsElementClass);
			if (previousSibling.length > 0) {
				this.swap(previousSibling.data("xmlElement"));
				return true;
			} else {
				return false;
			}
		};
		
		XMLElement.prototype.moveDown = function() {
			var nextSibling = this.guiElement.next("." + options.modsElementClass);
			if (nextSibling.length > 0) {
				nextSibling.data("xmlElement").swap(this);
				return true;
			} else {
				return false;
			}
		};
		
		XMLElement.prototype.addAttribute = function (attributeType) {
			var attributeValue = "";
			if (attributeType.defaultValue) {
				attributeValue = attributeType.defaultValue;
			}
			this.xmlNode.attr(attributeType.name, attributeValue);
			return attributeValue;
		};
		
		XMLElement.prototype.removeAttribute = function (attributeType) {
			this.xmlNode.removeAttr(attributeType.name);
			this.changeTabCount("attributes", -1, true);
		};
		
		XMLElement.prototype.changeTabTitle = function(tabID) {
			var data = this.tabs[tabID];
			if (data == null)
				return;
			var tabTitle = data.label;
			
			if (data.count > 0) {
				tabTitle += " (" + data.count +")";
			}
			data.link.html(tabTitle);
		};
		
		XMLElement.prototype.changeTabCount = function(tabID, count, add) {
			var data = this.tabs[tabID];
			if (data == null)
				return;
			
			if (arguments.length == 2 && add) {
				data.count += count;
			} else {
				data.count = count;
			}
			
			this.changeTabTitle(tabID);
		};
		
		XMLElement.prototype.select = function() {
			this.guiElement.addClass("selected");
		};
		
		XMLElement.prototype.focus = function() {
			focusElement(this.guiElement);
		};
		
		/**
		 * Stores data representing a single attribute for an element
		 */
		function XMLAttribute(attributeType, xmlElement) {
			this.attributeType = attributeType;
			this.xmlElement = xmlElement;
			this.attributeID = null;
			this.attributeInput = null;
			this.attributeContainer = null;
			this.addButton = null;
		}
		
		XMLAttribute.prototype.render = function (){
			this.attributeID = this.xmlElement.guiElementID + "_" + this.attributeType.name;
			
			var elementNode = this.xmlElement.guiElement;
			
			this.attributeContainer = $("<div/>").attr({
				'id' : this.attributeID + "_cont",
				'class' : 'attribute_container'
			}).appendTo(elementNode.children("." + options.attributesContainerClass));
			
			$('<label/>').attr({
				'for' : this.attributeID
			}).text(this.attributeType.name).appendTo(this.attributeContainer);
			
			var thiz = this;
			$("<a/>").html("(x)").css("cursor", "pointer").on('click', function() {
				if ($("#" + this.attributeID).length > 0) {
					if (this.addButton != null){
						this.addButton.removeClass("disabled");
					}
				}
				thiz.xmlElement.removeAttribute(thiz.attributeType);
				thiz.attributeContainer.remove();
				xmlState.documentChangedEvent();
			}).appendTo(this.attributeContainer);
			
			var attributeValue = this.xmlElement.xmlNode.attr(this.attributeType.name);
			if (attributeValue == '' && this.attributeType.defaultValue != null) {
				attributeValue = this.attributeType.defaultValue;
			}
			
			this.attributeInput = createElementInput(this.attributeType, this.attributeID, attributeValue, this.attributeContainer);
			
			this.attributeInput.data('xmlAttribute', this).change(function(){
				thiz.syncValue();
				xmlState.documentChangedEvent();
			});
			
			return this.attributeInput;
		};
		
		XMLAttribute.prototype.remove = function() {
			this.xmlElement.removeAttribute(attributeType);
			this.attributeContainer.remove();
		};
		
		XMLAttribute.prototype.syncValue = function() {
			this.xmlElement.xmlNode.attr(this.attributeType.name, this.attributeInput.val());
		};
		
		XMLAttribute.prototype.changeValue = function(value) {
			this.xmlElement.xmlNode.attr(this.attributeType.name, value);
		};
		
		/**
		 * Manages and tracks the state of the underlying document being edited.
		 */
		function DocumentState(baseXML) {
			this.baseXML = baseXML;
			this.xml = null;
			this.setXMLFromString(this.baseXML);
			this.changeState = 0;
		}
		
		DocumentState.prototype.isChanged = function() {
			return this.changeState > 1;
		};
		DocumentState.prototype.isBaseDocument = function() {
			return this.changeState == 0;
		};
		DocumentState.prototype.changesSaved = function() {
			return this.changeState == 1;
		};
		DocumentState.prototype.changesSynced = function() {
			return this.changeState == 2;
		};
		DocumentState.prototype.changesNotSynced = function() {
			return this.changeState == 3;
		};
		
		DocumentState.prototype.documentChangedEvent = function() {
			this.changeState == 2;
			undoHistory.captureSnapshot();
		};
		
		DocumentState.prototype.changesCommittedEvent = function() {
			this.changeState = 1;
			this.updateStateMessage();
		};
		
		DocumentState.prototype.changeEvent = function() {
			if (this.changeState < 2)
				this.changeState = 2;
			this.updateStateMessage();
		};
		
		DocumentState.prototype.unsyncedChangeEvent = function() {
			this.changeState = 3;
			this.updateStateMessage();
		};
		
		DocumentState.prototype.updateStateMessage = function () {
			if (this.isChanged()) {
				$("#" + options.submissionStatusId).html("Unsaved changes");
			} else {
				$("#" + options.submissionStatusId).html("All changes saved");
			}
		};
		
		DocumentState.prototype.setXMLFromString = function(xmlString) {
			// parseXML doesn't return any info on why a document is invalid, so do it the old fashion way.
			if (window.DOMParser) {
				parser = new DOMParser();
				if (options.prettyXML) {
					xmlString = vkbeautify.xml(xmlString);
				}
				xmlDoc = parser.parseFromString(xmlString, "application/xml");
				
				var parseError = xmlDoc.getElementsByTagName("parsererror");
				if (parseError.length > 0){
					throw new Error($(parseError).text());
				}
			} else {
				// Internet Explorer
				xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
				xmlDoc.async = false;
				if (options.prettyXML) {
					xmlString = vkbeautify.xml(xmlString);
				}
				xmlDoc.loadXML(xmlString);
				if (xmlDoc.parseError.errorCode != 0) {
					throw new Error("Error in line " + xmlDoc.parseError.line + " position " + xmlDoc.parseError.linePos
							+ "\nError Code: " + xmlDoc.parseError.errorCode + "\nError Reason: "
							+ xmlDoc.parseError.reason + "Error Line: " + xmlDoc.parseError.srcText);
				}
			}
			this.xml = $(xmlDoc);
			if (guiEditor.modsContent != null)
				guiEditor.modsContent.data("mods").elementNode = this.xml.children().first();
			if (problemsPanel != null)
				clearProblemPanel();
		};
		
		/**
		 * Manages the history of changes that have occurred.
		 */
		function UndoHistory() {
			this.states = [];
			this.headIndex = -1;
			this.stateChangeEvent = null;
			this.stateCaptureEvent = null;
		}
		
		UndoHistory.prototype.setStateChangeEvent = function(event) {
			this.stateChangeEvent = event;
			return this;
		};
		
		UndoHistory.prototype.setStateCaptureEvent = function(event) {
			this.stateCaptureEvent = event;
			return this;
		};
		
		UndoHistory.prototype.changeHead = function(step){
			if ((step < 0 && this.headIndex + step < 0) 
					|| (step > 0 && this.headIndex + step >= this.states.length
					||  this.headIndex + step >= options.undoHistorySize))
				return;
			
			this.headIndex += step;
			xmlState.xml = this.states[this.headIndex].clone();
			
			refreshDisplay();
			
			guiEditor.selectElement(null);
			if (this.stateChangeEvent != null)
				this.stateChangeEvent(this);
		};
		
		UndoHistory.prototype.captureSnapshot = function () {
			if (options.undoHistorySize <= 0)
				return;
			
			if (this.headIndex < this.states.length - 1) {
				this.states = this.states.slice(0, this.headIndex + 1);
			}
			
			if (this.states.length >= options.undoHistorySize) {
				this.states = this.states.slice(1, this.states.length);
			}

			this.headIndex = this.states.length;
			this.states.push(xmlState.xml.clone());
			
			if (this.stateCaptureEvent != null)
				this.stateCaptureEvent(this);
		};
		
		/**
		 * Header MenuBar object
		 */
		function MenuBar() {
			this.menuBarContainer = null;
			this.parentElement = null;
			this.updateFunctions = [];
			
			var thiz = this;
			this.headerMenuData = [ {
				label : 'File',
				enabled : true,
				action : function(event) {thiz.activateMenu(event);}, 
				items : [ {
						label : 'Submit to Server',
						enabled : (options.ajaxOptions.modsUploadPath != null),
						binding : "alt+shift+s",
						action : submitXML
					}, {
						label : 'Export',
						enabled : (getBlobBuilder() !== undefined),
						binding : "alt+shift+e",
						action : exportXML
					} ]
			}, {
				label : 'Edit',
				enabled : true,
				action : function(event) {thiz.activateMenu(event);},
				items : [ {
					label : 'Undo',
					enabled : false,
					binding : "ctrl+z or mac+z",
					action : function() {
							undoHistory.changeHead(-1);
						}
				}, {
					label : 'Redo',
					enabled : false,
					binding : "ctrl+y or mac+shift+z",
					action : function() {
							undoHistory.changeHead(1);
						}
				}, {
					label : 'Delete',
					enabled : true,
					binding : "del",
					action : function(){
						guiEditor.deleteSelected();
					}
				}, {
					label : 'Move Element Up',
					enabled : true,
					binding : "alt+up",
					action : function(){
						guiEditor.moveSelected(true);
					}
				}, {
					label : 'Move Element Down',
					enabled : true,
					binding : "alt+down",
					action : function(){
						guiEditor.moveSelected();
					}
				} ]
			}, {
				label : 'Select',
				enabled : true,
				action : function(event) {thiz.activateMenu(event);}, 
				items : [ {
						label : 'Deselect',
						enabled : true,
						binding : "esc",
						action : function(){
							guiEditor.selectElement(null);
						}
					},{
						label : 'Next Element',
						enabled : true,
						binding : "down",
						action : function(){
							guiEditor.selectNext();
						}
					}, {
						label : 'Previous Element',
						enabled : true,
						binding : "up",
						action : function(){
							guiEditor.selectNext(true);
						}
					}, {
						label : 'Parent',
						enabled : true,
						binding : "shift+left",
						action : function(){
							guiEditor.selectParent();
						}
					}, {
						label : 'First Child',
						enabled : true,
						binding : "shift+right",
						action : function(){
							guiEditor.selectParent(true);
						}
					}, {
						label : 'Next Sibling',
						enabled : true,
						binding : "shift+down",
						action : function(){
							guiEditor.selectSibling();
						}
					}, {
						label : 'Previous Sibling',
						enabled : true,
						binding : "shift+up",
						action : function(){
							guiEditor.selectSibling(true);
						}
					} ]
			}, {
				label : 'View',
				enabled : true,
				action : function(event) {thiz.activateMenu(event);}, 
				items : [ {
					label : 'Next Element Tab',
					enabled : true,
					binding : "right",
					action : function(){
						guiEditor.changeSelectedTab();
					}
				}, {
					label : 'Previous Element Tab',
					enabled : true,
					binding : "left",
					action : function(){
						guiEditor.changeSelectedTab(true);
					}
				}, {
					label : 'Switch to MODS View',
					enabled : true,
					binding : "alt+shift+m",
					action : function() {
						modsTabContainer.tabs('select', 0);
					}
				}, {
					label : 'Switch to XML View',
					enabled : true,
					binding : "alt+shift+x",
					action : function() {
						modsTabContainer.tabs('select', 1);
					}
				} ]
			}, {
				label : 'Help',
				enabled : true,
				action : function(event) {thiz.activateMenu(event);}, 
				items : [ {
					label : 'MODS Outline of Elements',
					enabled : true,
					binding : null,
					action : "http://www.loc.gov/standards/mods/mods-outline.html"
				} ]
			}, {
				label : 'MODS',
				enabled : true, 
				itemClass : 'header_mode_tab',
				action : function() {
					modsTabContainer.tabs('select', 0);
				}
			}, {
				label : 'XML',
				enabled : true, 
				itemClass : 'header_mode_tab',
				action : function() {
					modsTabContainer.tabs('select', 1);
				}
			} ];
		}
		
		MenuBar.prototype.activateMenu = function(event) {
			if (this.menuBarContainer.hasClass("active")) {
				this.menuBarContainer.removeClass("active");
				return;
			}
			$.each(this.updateFunctions, function() {
				this();
			});
			this.menuBarContainer.addClass("active");
			this.menuBarContainer.children("ul").children("li").click(function (event) {
				event.stopPropagation();
			});
			var thiz = this;
			$('html').one("click" ,function() {
				thiz.menuBarContainer.removeClass("active");
			});
			event.stopPropagation();
		};
		
		MenuBar.prototype.render = function(parentElement) {
			this.parentElement = parentElement;
			this.menuBarContainer = $("<div/>").attr('id', options.modsMenuBarId).appendTo(parentElement);
			
			this.headerMenu = $("<ul/>");
			this.menuBarContainer.append(this.headerMenu);
			
			var menuBar = this;
			$.each(this.headerMenuData, function() {
				menuBar.generateMenuItem(this, menuBar.headerMenu);
			});
		};
		
		MenuBar.prototype.generateMenuItem = function(menuItemData, parentMenu) {
			var menuItem = $("<li/>").appendTo(parentMenu);
			var menuItemLink = $("<a/>").appendTo(menuItem).html("<span>" + menuItemData.label + "</span>");
			if (menuItemData.binding) {
				menuItemLink.append("<span class='binding'>" + menuItemData.binding + "</span>");
			}
			if (menuItemData.action != null) {
				if (Object.prototype.toString.call(menuItemData.action) == '[object Function]'){
					menuItem.click(menuItemData.action);
				} else {
					menuItemLink.attr({"href": menuItemData.action, "target" : "_blank"});
				}
			}
			if (!menuItemData.enabled) {
				menuItem.addClass("disabled");
			}
			if (menuItemData.itemClass) {
				menuItem.addClass(menuItemData.itemClass);
			}
			
			var menuBar = this;
			menuItem.data("menuItemData", menuItemData).attr("id", options.modsMenuHeaderPrefix + menuItemData.label.replace(/ /g, "_"));
			if (menuItemData.items !== undefined && menuItemData.items.length > 0) {
				var subMenu = $("<ul/>").addClass('sub_menu').appendTo(menuItem);
				$.each(menuItemData.items, function() {
					menuBar.generateMenuItem(this, subMenu);
				});
			}
		};
		
		/**
		 * Menu object for adding new elements to an existing element or document
		 * @param menuID
		 * @param label
		 * @param expanded
		 * @param enabled
		 * @returns
		 */
		function ModifyElementMenu(menuID, label, expanded, enabled) {
			this.menuID = menuID;
			this.label = label;
			this.menuHeader = null;
			this.menuContent = null;
			this.enabled = enabled;
			this.expanded = expanded;
			this.target = null;
		}
		
		ModifyElementMenu.prototype.destroy = function() {
			if (this.menuHeader != null)
				this.menuHeader.remove();
			if (this.menuContent != null)
				this.menuContent.remove();
		};
		
		ModifyElementMenu.prototype.render = function(parentContainer) {
			this.menuHeader = $("<div class='" + options.menuHeaderClass + "'/>").appendTo(parentContainer);
			if (this.expanded) {
				this.menuHeader.html(this.label + " <span>&#9660;</span>");
			} else {
				this.menuHeader.html(this.label + " <span>&#9654;</span>");
			}
			
			if (!this.enabled)
				this.menuHeader.addClass("disabled");
			
			this.menuContent = $("<ul id='" + this.menuID + "' class='" + options.menuContentClass + "'/>").data('menuData', this).appendTo(parentContainer);
			var thiz = this;
			this.menuHeader.click(function(){
				if (!thiz.enabled) {
					return;
				}
				
				if (thiz.expanded) {
					thiz.menuContent.animate({height: 'hide'}, options.menuExpandDuration, null, function(){
						thiz.menuContent.hide();
					});
					thiz.menuHeader.html(thiz.label + " <span>&#9654;</span>");
					thiz.expanded = false;
				} else {
					thiz.menuContent.show();
					thiz.menuContent.animate({height: 'show'}, options.menuExpandDuration);
					thiz.menuHeader.html(thiz.label + " <span>&#9660;</span>");
					thiz.expanded = true;
				}
			});
			return this;
		};
		
		ModifyElementMenu.prototype.clear = function() {
			var startingHeight = this.menuContent.height();
			this.menuContent.empty();
			this.menuContent.css({height: startingHeight + "px"}).stop().animate({height: "0px"}, options.menuExpandDuration);
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
			thiz = this;
			
			$.each(this.target.elementType.elements, function(){
				var modsElement = this;
				$("<li/>").attr({
					title : 'Add ' + modsElement.name
				}).html(modsElement.name).click(addChildElementCallback).data('mods', {
					"target": xmlElement,
					"elementType": modsElement
				}).appendTo(thiz.menuContent);
			});
			if (this.expanded) {
				var endingHeight = this.menuContent.outerHeight() + 1;
				if (endingHeight == 0)
					endingHeight = 1;
				this.menuContent.css({height: startingHeight + "px"}).stop().animate({height: endingHeight + "px"}, options.menuExpandDuration).show();
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
		
		function AttributeMenu(menuID, label, expanded, enabled) {
			ModifyElementMenu.call(this, menuID, label, expanded, enabled);
		}
		
		AttributeMenu.prototype.constructor = AttributeMenu;
		AttributeMenu.prototype = Object.create( ModifyElementMenu.prototype );

		
		AttributeMenu.prototype.populate = function (xmlElement) {
			if (xmlElement == null || (this.target != null && xmlElement.guiElement != null 
					&& this.target[0] === xmlElement.guiElement[0]))
				return;
			
			if (this.expanded)
				this.menuContent.css("height", "auto");
			var startingHeight = this.menuContent.outerHeight();
			this.menuContent.empty();
			
			this.target = xmlElement;
			
			var attributesArray = this.target.elementType.attributes;
			var attributesPresent = {};
			$(this.target.xmlNode[0].attributes).each(function() {
				var targetAttribute = this;
				$.each(attributesArray, function(){
					if (this.name == targetAttribute.nodeName) {
						attributesPresent[this.name] = $("#" + xmlElement.guiElementID + "_" + targetAttribute.nodeName);
					}
				});
			});
			
			var thiz = this;
			$.each(this.target.elementType.attributes, function(){
				var attribute = this;
				var addButton = $("<li/>").attr({
					title : 'Add ' + attribute.name,
					'id' : xmlElement.guiElementID + "_" + attribute.name + "_add"
				}).html(attribute.name).click(addAttributeButtonCallback).data('mods', {
					"attributeType": attribute,
					"target": xmlElement
				}).appendTo(thiz.menuContent);
				
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
				this.menuContent.css({height: startingHeight + "px"}).stop().animate({height: endingHeight + "px"}, options.menuExpandDuration).show();
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
		
		/**
		 * Menu panel for managing individual modification menus.
		 */
		function ModifyMenuPanel() {
			this.menus = {};
			this.menuColumn = null;
			this.menuContainer = null;
		}
		
		ModifyMenuPanel.prototype.initialize = function (parentContainer) {
			this.menuColumn = $("<div/>").attr('id', options.menuColumnId).appendTo(parentContainer);
			$("<span/>").attr('id', options.submissionStatusId).html("Document is unchanged").appendTo(this.menuColumn);
			
			var submitButton = $("<input/>").attr({
				'id' : options.submitButtonId,
				'type' : 'button',
				'class' : 'send_xml',
				'name' : 'submit',
				'value' : 'Submit Changes'
			}).appendTo(this.menuColumn);
			if (options.ajaxOptions.modsUploadPath == null) {
				if (getBlobBuilder()){
					submitButton.attr("value", "Export");
				} else {
					submitButton.attr("disabled", "disabled");
				}
			}
			
			this.menuContainer = $("<div class='" + options.menuContainerClass + "'/>").appendTo(this.menuColumn);
			this.menuContainer.css({'max-height': $(window).height(), 'overflow-y': 'auto'});
			return this;
		};
		
		ModifyMenuPanel.prototype.addMenu = function(menuID, label, expanded, enabled, contextual) {
			if (arguments.length == 4)
				contextual = false;
			var menu = new ModifyElementMenu(menuID, label, expanded, enabled);
			this.menus[menuID] = {
					"menu" : menu, 
					"contextual": contextual
				};
			menu.render(this.menuContainer);
			return menu;
		};
		
		ModifyMenuPanel.prototype.addAttributeMenu = function(menuID, label, expanded, enabled, contextual) {
			if (arguments.length == 4)
				contextual = false;
			var menu = new AttributeMenu(menuID, label, expanded, enabled);
			this.menus[menuID] = {
					"menu" : menu, 
					"contextual": contextual
				};
			menu.render(this.menuContainer);
			return menu;
		};
		
		ModifyMenuPanel.prototype.clearContextualMenus = function() {
			$.each(this.menus, function(){
				if (this.contextual) {
					this.menu.clear();
				}
			});
			this.setMenuPosition();
			return this;
		};
		
		ModifyMenuPanel.prototype.refreshContextualMenus = function(targetElement) {
			$.each(this.menus, function(){
				if (this.contextual) {
					this.menu.populate(targetElement);
				}
			});
			this.setMenuPosition();
			return this;
		};
		
		ModifyMenuPanel.prototype.setMenuPosition = function(){
			if (this.menuColumn == null || this.menuColumn.offset() == null)
				return;
			
			var menuTop = modsWorkAreaContainer.offset().top;
			if ($(window).scrollTop() >= menuTop) {
				this.menuColumn.css({
					position : 'fixed',
					left : modsEditorContainer.offset().left + modsEditorContainer.outerWidth() - this.menuColumn.outerWidth(),
					top : 0
				});
				editorHeader.css({
					position : (guiEditor.active)? 'fixed' : 'absolute',
					top : (guiEditor.active)? 0 : menuTop
				});
			} else {
				this.menuColumn.css({
					position : 'absolute',
					left : modsEditorContainer.offset().left + modsEditorContainer.outerWidth() - this.menuColumn.outerWidth(),
					top : menuTop
				});
				editorHeader.css({
					position : 'absolute',
					top : menuTop
				});
			}
			
			// Adjust the menu's height so that it doesn't run out of the editor container
			
			// Gap between the top of the column and the beginning of the actual menu
			var menuOffset = modifyMenu.menuContainer.offset().top - this.menuColumn.offset().top;
			// Default height matches the height of the work area
			var menuHeight = modsWorkAreaContainer.height() - menuOffset;
			
			var workAreaOffset = this.menuColumn.offset().top - $(window).scrollTop();
			if (workAreaOffset < 0)
				workAreaOffset = 0;
			// Prevent menu from exceeding window height
			if (menuHeight + menuOffset > $(window).height()) {
				menuHeight = $(window).height() - menuOffset;
			}
			
			// Prevent menu from exceeding editor height
			if (menuHeight + menuOffset > modsWorkAreaContainer.height() + modsWorkAreaContainer.offset().top - $(window).scrollTop()) {
				menuHeight = modsWorkAreaContainer.height() + modsWorkAreaContainer.offset().top - $(window).scrollTop() - menuOffset;
			}
			this.menuContainer.css({'max-height': menuHeight});
			return this;
		};
		
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
				if (!(elementObject in this.tree[elementTitle]))
					this.tree[elementTitle][parentTitle] = elementObject;
			} else {
				this.tree[elementTitle] = {};
				this.tree[elementTitle][parentTitle] = elementObject;
			}
			var schemaTree = this;
			$.each(elementObject.elements, function() {
				schemaTree.build(this.name, this, elementObject.name);
			});
		};
		
		function GUIEditor() {
			this.guiContent = null;
			this.modsContent = null;
			this.elementIndex = 0;
			this.rootElement = null;
			this.active = false;
			this.selectedElement = null;
		}
		
		GUIEditor.prototype.initialize = function(parentContainer) {
			this.modsContent = $("<div id='" + options.modsContentId + "'/>");
			this.modsContent.data("mods", {});
			$("<div/>").attr("class", "placeholder").html("There are no elements in this document.  Use the menu on the right to add new top level elements.")
					.appendTo(this.modsContent);
			
			parentContainer.append(this.modsContent);
			
			this.rootElement = new XMLElement(xmlState.xml.children().first(), schema);
			this.rootElement.guiElement = this.modsContent;
			this.rootElement.guiElement.data("xmlElement", this.rootElement);
			this.rootElement.childContainer = this.modsContent;
			return this;
		};
		
		GUIEditor.prototype.activate = function() {
			this.active = true;
			this.deselectElement();
			if (textEditor.isModified()){
				refreshDisplay();
			}
			
			textEditor.resetSelectedTagRange();
			if (textEditor.isInitialized() && xmlState.isChanged()) {
				refreshDisplay();
				textEditor.setInitialized();
			}
			
			modifyMenu.clearContextualMenus();
			return this;
		};
		
		GUIEditor.prototype.deactivate = function() {
			this.active = false;
			return this;
		};
		
		GUIEditor.prototype.nextIndex = function() {
			return ++this.elementIndex;
		};
		
		GUIEditor.prototype.clearElements = function() {
			$("." + options.topLevelContainerClass).remove();
			return this;
		};
		
		GUIEditor.prototype.resize = function() {
			//modsContent.width(guiContent.width() - menuContainer.width() - 30);
			return this;
		};
		
		GUIEditor.prototype.refreshDisplay = function() {
			this.elementIndex = 0;
			this.rootElement.xmlNode = xmlState.xml.children().first();
			this.refreshElements();
			return this;
		};

		GUIEditor.prototype.refreshElements = function() {
			this.rootElement.renderChildren(this.modsContent, true);
			return this;
		};
		
		GUIEditor.prototype.addElementEvent = function(parentElement, newElement) {
			if (parentElement.guiElementID != this.modsContent.attr("id")) {
				parentElement.changeTabCount("elements", 1, true);
				parentElement.guiElement.tabs("select", parentElement.guiElementID + "_tab_elements");
			}
			focusElement(newElement.guiElement);
			this.selectElement(newElement);
		};
		
		GUIEditor.prototype.addAttributeEvent = function(parentElement, attributeType, addButton) {
			var attribute = new XMLAttribute(attributeType, parentElement);
			attribute.render();
			parentElement.changeTabCount('attributes', 1, true);
			parentElement.guiElement.tabs("select", parentElement.guiElementID + "_tab_attributes");
			focusElement(attribute.attributeContainer);
			addButton.addClass("disabled");
			attribute.addButton = addButton;
			xmlState.documentChangedEvent();
		};
		
		GUIEditor.prototype.selectElement = function(selected) {
			$("." + options.modsElementClass + ".selected").removeClass("selected");
			if (selected == null) {
				this.deselectElement();
				modifyMenu.clearContextualMenus();
			} else {
				if (selected instanceof XMLElement){
					this.selectedElement = selected;
				} else {
					selected = $(selected);
					this.selectedElement = selected.data("xmlElement");
					selected = this.selectedElement;
				}
				selected.select();
				modifyMenu.refreshContextualMenus(selected);
			}
			return this;
		};
		
		GUIEditor.prototype.deselectElement = function() {
			$("." + options.modsElementClass + ".selected").removeClass("selected");
			this.selectedElement = null;
			return this;
		};
		
		GUIEditor.prototype.deleteSelected = function() {
			if (this.selectedElement == null)
				return this;
			// After delete, select next sibling, previous sibling, or parent, as available.
			var afterDeleteSelection = this.selectedElement.guiElement.next("." + options.modsElementClass);
			if (afterDeleteSelection.length == 0)
				afterDeleteSelection = this.selectedElement.guiElement.prev("." + options.modsElementClass);
			if (afterDeleteSelection.length == 0)
				afterDeleteSelection = this.selectedElement.guiElement.parents("." + options.modsElementClass).first();
			
			this.selectedElement.remove();
			xmlState.documentChangedEvent();
			
			this.selectElement(afterDeleteSelection);
			return this;
		};
		
		GUIEditor.prototype.moveSelected = function(up) {
			if (this.selectedElement == null)
				return this;
			var result = up? this.selectedElement.moveUp() : this.selectedElement.moveDown();
			if (result)
				xmlState.documentChangedEvent();
			this.selectedElement.focus();
			return this;
		};
		
		GUIEditor.prototype.selectSibling = function(reverse) {
			var direction = reverse? 'prev' : 'next';
			if (this.selectedElement.guiElement.length > 0) {
				newSelection = this.selectedElement.guiElement[direction]("." + options.modsElementClass);
				if (newSelection.length == 0 && !this.selectedElement.isTopLevel) {
					// If there is no next sibling but the parent has one, then go to parents sibling
					this.selectedElement.guiElement.parents("." + options.modsElementClass).each(function(){
						newSelection = $(this)[direction]("." + options.modsElementClass);
						if (newSelection.length > 0 || $(this).data("xmlElement").isTopLevel)
							return false;
					});
				}
			} else {
				if (!reverse)
					newSelection = $("." + options.modsElementClass).first();
			}
			
			if (newSelection.length == 0)
				return this;
			this.selectElement(newSelection.first()).selectedElement.focus();
			return this;
		};
		
		GUIEditor.prototype.selectParent = function(reverse) {
			if (reverse)
				newSelection = this.selectedElement.guiElement.find("." + options.modsElementClass);
			else newSelection = this.selectedElement.guiElement.parents("." + options.modsElementClass);
			if (newSelection.length == 0)
				return this;
			this.selectElement(newSelection.first()).selectedElement.focus();
			return this;
		};
		
		GUIEditor.prototype.selectNext = function(reverse) {
			if (this.selectedElement == null) {
				if (!reverse)
					newSelection = $("." + options.modsElementClass).first();
			} else {
				var found = false;
				var allElements = $("." + options.modsElementClass + ":visible", guiEditor.modsContent);
				
				if (reverse)
					allElements = $(allElements.get().reverse());
				
				var selectedElement = this.selectedElement;
				allElements.each(function(){
					if (found) {
						newSelection = $(this);
						return false;
					} else if (this.id == selectedElement.guiElementID) {
						found = true;
					}
				});
			}
			
			this.selectElement(newSelection.first()).selectedElement.focus();
			return this;
		};
		
		GUIEditor.prototype.focusSelectedFirstInput = function() {
			if (this.selectedElement == null)
				return this;
			var focused = this.selectedElement.guiElement.find("input[type=text]:visible, textarea:visible, select:visible").first().focus();
			// If the focused input was in an element other than the selected one, then select it
			var containerElement = focused.parents("." + options.modsElementClass);
			if (containerElement !== this.selectedElement)
				this.selectElement(containerElement);
			return this;
		};
		
		GUIEditor.prototype.focusInput = function(reverse) {
			var focused = $("input:focus, textarea:focus, select:focus");
			if (focused.length == 0 && this.selectedElement == null) {
				if (reverse)
					return this;
				// Nothing is selected or focused, so grab the first available input
				focused = this.modsContent.find("input[type=text]:visible, textarea:visible, select:visible").first().focus();
			} else {
				// When an input is already focused, tabbing selects the next input
				var foundFocus = false;
				var inputsSelector = "input[type=text]:visible, textarea:visible, select:visible";
				// If no inputs are focused but an element is selected, seek the next input near this element
				if (this.selectedElement != null && focused.length == 0) {
					inputsSelector += ", ." + options.modsElementClass;
					focused = this.selectedElement.guiElement;
				}
				var visibleInputs = this.modsContent.find(inputsSelector);
				// If in reverse mode, get the previous input
				if (reverse) {
					visibleInputs = $(visibleInputs.get().reverse());
				}
				// Seek the next input after the focused one
				visibleInputs.each(function(){
					// Can't focus a mods class if they are present.
					if (foundFocus && !$(this).hasClass(options.modsElementClass)) {
						focused = $(this).focus();
						return false;
					} else if (this.id == focused.attr('id')) {
						foundFocus = true;
					}
				});
			}
			// If the focused input was in an element other than the selected one, then select it
			var containerElement = focused.parents("." + options.modsElementClass);
			if (containerElement !== this.selectedElement)
				this.selectElement(containerElement);
			return this;
		};
		
		GUIEditor.prototype.changeSelectedTab = function(reverse) {
			if (this.selectedElement == null)
				return this;
			var currentTab = this.selectedElement.guiElement.tabs('option', 'selected') + (reverse? -1: 1);
			if (currentTab < this.selectedElement.guiElement.tabs('length') && currentTab >= 0) {
				this.selectedElement.guiElement.tabs('option', 'selected', currentTab);
			}
			return this;
		};
		
		/**
		 * Editor object for doing text editing of the XML document using the cloud9 editor
		 */
		function TextEditor() {
			this.editor = null;
			this.state = 0;
			this.xmlEditorDiv = null;
			this.xmlContent = null;
			this.selectedTagRange = null;
			this.resetSelectedTagRange();
			this.active = false;
		}
		
		TextEditor.prototype.resetSelectedTagRange = function() {
			this.selectedTagRange = {'row': 0, 'startColumn': 0, 'endColumn': 0};
			return this;
		};
		
		TextEditor.prototype.initialize = function(parentContainer) {
			this.xmlContent = parentContainer;
			this.xmlEditorDiv = $("<div/>").attr('id', 'xml_editor').appendTo(parentContainer);
			this.editor = ace.edit("xml_editor");
			this.editor.setTheme("ace/theme/textmate");
			this.editor.getSession().setMode("ace/mode/xml");
			this.editor.setShowPrintMargin(false);
			this.editor.getSession().setUseSoftTabs(true);
			
			var thiz = this;
			this.editor.getSession().on('change', function(){
				if (!xmlState.changesNotSynced() && thiz.isPopulated()){
					xmlState.unsyncedChangeEvent();
					thiz.setModified();
				}
			});
			this.editor.getSession().selection.on('changeCursor', function(){
				thiz.selectTagAtCursor();
			});
			
			this.setInitialized();
			return this;
		};
		
		TextEditor.prototype.activate = function() {
			this.active = true;
			
			if (!this.isInitialized()){
				this.initialize(xmlContent);
			}
			this.refreshDisplay();
			
			this.resize();
			return this;
		};
		
		TextEditor.prototype.deactivate = function() {
			this.active = false;
			modifyMenu.clearContextualMenus();
			if (this.isInitialized()) {
				this.setInitialized();
			}
			return this;
		};
		
		TextEditor.prototype.isInitialized = function() {
			return this.state > 0;
		};
		
		TextEditor.prototype.isPopulated = function() {
			return this.state > 1;
		};
		
		TextEditor.prototype.isModified = function() {
			return this.state > 2;
		};
		
		TextEditor.prototype.setInitialized = function() {
			this.state = 1;
			return this;
		};
		
		TextEditor.prototype.setPopulated = function() {
			this.state = 2;
			return this;
		};
		
		TextEditor.prototype.setModified = function() {
			this.state = 3;
			return this;
		};
		
		TextEditor.prototype.inSelectedTag = function(row, startColumn, endColumn) {
			return !xmlState.changesNotSynced() && row == this.selectedTagRange.row 
				&& startColumn == this.selectedTagRange.startColumn 
				&& endColumn == this.selectedTagRange.endColumn;
		};
		
		
		TextEditor.prototype.reload = function() {
			this.setInitialized();
			this.selectedTagRange = {'row': 0, 'startColumn': 0, 'endColumn': 0};
			var cursorPosition = this.editor.selection.getCursor();
			this.editor.getSession().setValue(xml2Str(xmlState.xml));
			this.setPopulated();
			this.editor.focus();
			this.editor.selection.moveCursorToPosition(cursorPosition);
			return this;
		};
		
		TextEditor.prototype.refreshDisplay = function() {
			var markers = this.editor.session.getMarkers();
			var thiz = this;
			$.each(markers, function(index) {
				thiz.editor.session.removeMarker(index);
			});
			
			this.setInitialized();
			$("#" + options.xmlTabId).html(options.xmlTabLabel);
			var xmlString = xml2Str(xmlState.xml);
			try {
				this.editor.getSession().setValue(xmlString);
			} catch (e) {
				alert(e);
			}
			
			this.editor.clearSelection();
			this.setPopulated();
			
			this.selectTagAtCursor();
			return this;
		};
		
		TextEditor.prototype.resize = function() {
			var xmlEditorHeight = ($(window).height() - this.xmlEditorDiv.offset().top);
			this.xmlContent.css({'height': xmlEditorHeight + 'px'});
			this.xmlEditorDiv.width(this.xmlContent.innerWidth());
			this.xmlEditorDiv.height(xmlEditorHeight);
			if (modifyMenu.menuContainer != null)
				modifyMenu.menuContainer.css({'max-height': $(modsWorkAreaContainer).height() - modifyMenu.menuContainer.offset().top});
			if (this.editor != null)
				this.editor.resize();
			return this;
		};
		
		TextEditor.prototype.selectTagAtCursor = function() {
			if (!this.isInitialized())
				return this;
			var currentLine = this.editor.getSession().getDocument().getLine(this.editor.selection.getCursor().row);
			var openingIndex = currentLine.lastIndexOf("<", this.editor.selection.getCursor().column);
			var preceedingClosingIndex = currentLine.lastIndexOf(">", this.editor.selection.getCursor().column);
			
			// Not inside a tag
			if (openingIndex <= preceedingClosingIndex)
				return this;
			
			var currentRow = this.editor.selection.getCursor().row;
			var closingIndex = currentLine.indexOf(">", this.editor.selection.getCursor().column);
			if (closingIndex == -1)
				closingIndex = currentLine.length - 1;
			
			var tagRegex = /<((mods:)?[a-zA-Z]+)( |\/|>|$)/;
			var match = tagRegex.exec(currentLine.substring(openingIndex));
			
			// Check to see if the tag being selected is already selected.  If it is and the document hasn't been changed, then quit.
			if (match != null && !this.inSelectedTag(currentRow, openingIndex, closingIndex)){
				var tagTitle = match[1];
				var prefixedTitle = tagTitle;
				var unprefixedTitle = tagTitle;
				if (tagTitle.indexOf("mods:") == -1){
					prefixedTitle = "mods:" + prefixedTitle;
				} else {
					unprefixedTitle = tagTitle.substring(tagTitle.indexOf(":") + 1);
				}
				
				// No element type or is the root node, done.
				if (!(unprefixedTitle in modsTree.tree) || unprefixedTitle == "mods")
					return this;
				var elementType = modsTree.tree[unprefixedTitle];
				
				if (xmlState.changesNotSynced()) {
					//Refresh the xml if it has changed
					try {
						setXMLFromEditor();
						xmlState.changeEvent();
					} catch (e) {
						// XML isn't valid, so can't continue
						return this;
					}
				}
				
				var Range = require("ace/range").Range;
				var range = new Range(0, 0, this.editor.selection.getCursor().row, openingIndex);
				var preceedingLines = this.editor.getSession().getDocument().getTextRange(range);
				
				var instanceNumber = tagOccurrences(preceedingLines, tagTitle);
				// Get xpath to this object using jquery.
				var elementNode = $("*", xmlState.xml).filter(function() {
			        return modsEquals(this, unprefixedTitle);
			      })[instanceNumber];
				if (elementNode == null)
					return;
				
				// Attempt to disambiguate by selecting by parent tag name.
				if (elementNode.parentNode == null || elementNode.parentNode.tagName == null)
					return this;
				var tagName = elementNode.parentNode.tagName;
				if (tagName.indexOf(":") != -1){
					tagName = tagName.substring(tagName.indexOf(":") + 1);
				}
				
				$.each(elementType, function(key, value){
					if (key == tagName && value.namespace == modsNS){
						elementType = this;
						return false;
					}
				});
					
				if (elementType == null) {
					modifyMenu.clearContextualMenus();
					return this;
				}
				
				var dummyTarget = null;
				try {
					dummyTarget = new XMLElement(elementNode, elementType);
				} catch(e) {
					return this;
				}
				
				modifyMenu.refreshContextualMenus(dummyTarget).setMenuPosition();
				
				this.selectedTagRange.row = currentRow;
				this.selectedTagRange.startColumn = openingIndex;
				this.selectedTagRange.endColumn = closingIndex;
				
				var Range = require("ace/range").Range;
				var markers = this.editor.session.getMarkers();
				
				var thiz = this;
				$.each(markers, function(index) {
					thiz.editor.session.removeMarker(index);
				});
				this.editor.session.addMarker(new Range(this.selectedTagRange.row, 
						this.selectedTagRange.startColumn, this.selectedTagRange.row, 
						this.selectedTagRange.endColumn + 1), "highlighted", "line", false);
			}
				
			return this;
		};
		
		TextEditor.prototype.addElementEvent = function(parentElement, newElement) {
			this.reload();
			// Move cursor to the newly added element
			var instanceNumber = 0;
			xmlState.xml.find(newElement.xmlNode[0].localName).each(function() {
				if (this === newElement.xmlNode.get(0)) {
					return false;
				}
				instanceNumber++;
			});
			var Range = require("ace/range").Range;
			var startPosition = new Range(0,0,0,0);
			var pattern = new RegExp("<(mods:)?" + newElement.xmlNode[0].localName +"(\\s|\\/|>|$)", "g");
			this.editor.find(pattern, {'regExp': true, 'start': startPosition, 'wrap': false});
			for (var i = 0; i < instanceNumber; i++) {
				this.editor.findNext({'needle' : pattern});
			}
			this.editor.clearSelection();
			this.editor.selection.moveCursorBy(0, -1 * newElement.xmlNode[0].localName.length);
		};
		
		TextEditor.prototype.addAttributeEvent = function() {
			textEditor.reload();
			xmlState.changeEvent();
		};
		
		// Start up the editor
		initializeEditor();
	};
})(jQuery);
