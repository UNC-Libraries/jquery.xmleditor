//= require_self
//= require_tree .

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
 * jQuery xml Editor
 * 
 * Dependencies:
 *   jquery 1.7+
 *   jquery.ui 1.9+
 *   ajax ace editor
 *   jquery.autosize.js (optional)
 * 
 * @author Ben Pennell
 */
 
// Selector and class name constants
var menuContainerClass = "xml_menu_container";
var menuHeaderClass = "menu_header";
var menuColumnClass = "xml_menu_column";
var menuContentClass = 'menu_content';
var menuExpandDuration = 180;
var xmlElementClass = 'xml_element';
var xmlTextClass = 'xml_text_node';
var xmlNodeClass = 'xml_node';
var topLevelContainerClass = 'top_level_element_group';
var elementRootPrefix = "root_element_";
var elementPrefix = "xml_element_";
var childrenContainerSelector = " > .xml_children";
var childrenContainerClass = "xml_children";
var attributeContainerClass = "attribute_container";
var attributesContainerSelector = " > .xml_attrs";
var attributesContainerClass = "xml_attrs";
var xmlMenuHeaderPrefix = "xml_header_item_";
var xmlEditorContainerClass = "xml_editor_container";
var xmlWorkAreaContainerClass = "xml_work_area";
var addTopMenuClass = "add_top_menu";
var addAttrMenuClass = "add_attribute_menu";
var addElementMenuClass = "add_element_menu";
var addNodeMenuClass = "add_node_menu";
var xmlMenuBarClass = "xml_menu_bar";
var submitButtonClass = "send_xml";
var submissionStatusClass = "xml_submit_status";
var xmlContentClass = "xml_content";

var editorTabAreaClass = "xml_tab_area";
var problemsPanelClass = "xml_problems_panel";
var guiContentClass = "gui_content";
var textContentClass = "text_content";
var editorHeaderClass = "xml_editor_header";

// Returns the local name of a node.  Needed for older versions of ie
var localName = function(node) {
	var localName = node.localName;
	if (localName) return localName;
	var index = node.nodeName.indexOf(':');
	if (index == -1) return node.nodeName;
	return node.nodeName.substring(index + 1);
};

$.widget( "xml.xmlEditor", {
	options: {
		// Schema object to be used
		schema: null,
		// Whether or not to attempt to load the schema in a worker thread, if available
		loadSchemaAsychronously: true,
		// Path to directory containing cycle.js, needed for loadSchemaAsychronously
		libPath: null,
		// Document retrieval and upload parameters
		ajaxOptions : {
			xmlUploadPath: null,
			xmlRetrievalPath: null,
			xmlRetrievalParams : null
		},

		// User set default template settings
		templatePath : false,
    	templates : [],
    	defaultTemplate : false,
		cancelTemplate : false,

		// Function triggered after uploading XML document, to interpret if the response was successful or not.  If upload failed, an error message should be returned.
		submitResponseHandler : null,
		// Function triggered after uploading XML document, if an error occurs. Gives full text of error, instead of a boilerplate "500 server error" message.
		submitErrorHandler : null,

		submitButtonConfigs : null,
		// Event function trigger after an xml element is update via the gui
		elementUpdated : undefined,
		// Title for the document, displayed in the header
		documentTitle : null,
		addTopMenuHeaderText : 'Add Top Element',
		addAttrMenuHeaderText : 'Add Attribute',
		addElementMenuHeaderText : 'Add Subelement',
		xmlEditorLabel : 'XML',
		textEditorLabel : 'Text',
		
		// Set to false to get rid of the 
		enableDocumentStatusPanel : true,
		documentStatusPanelDomId : "<div>",
		confirmExitWhenUnsubmitted : true,
		enableGUIKeybindings : true,
		floatingMenu : true,
		// Requires jquery.autosize, defaults to false if plugin isn't detected
		expandingTextAreas: true,
		
		// Pretty formatting of XML output.  Requires vkbeauty.js, defaults to false is not available
		prettyXML : true,
		// Number of history states held for the undo feature
		undoHistorySize: 20,
		// Object containing additional entries to add to the header menu
		menuEntries: undefined,
		enforceOccurs: false,
		prependNewElements: false,
		autocomplete: true,
		
		targetNS: null
	},
	
	_create: function() {
		var self = this;
		var schema = this.options.schema;
		var libPath = this.options.libPath;

		this.instanceNumber = $("xml-xmlEditor").length;
		
		// Tree of xml element types
		this.schemaTree = null;
		// State of the XML document
		this.xmlState = null;
		// Container for the entire editor
		this.xmlEditorContainer = null;
		// Container for the subeditors
		this.xmlWorkAreaContainer = null;
		// Tabbed container for differentiating between specific subeditors
		this.xmlTabContainer = null;
		// Header container for the menu and top level info
		this.editorHeader = null;
		// Panel for displaying errors
		this.problemsPanel = null;
		// GUI Editor object
		this.guiEditor = null;
		// Text Editor object
		this.textEditor = null;
		// Currently active editor
		this.activeEditor = null;
		// History manager for undo/redo
		this.undoHistory = null;
		// Top level menu bar object
		this.menuBar = null;
		// Element modification object
		this.modifyMenu = null;
		// Flag indicating if the editor was initialized on a text area that will need to be updated
		this.isTextAreaEditor = false;

		var url = document.location.href;
		var index = url.lastIndexOf("/");
		if (index != -1)
			this.baseUrl = url.substring(0, index + 1);
		
		// Detect optional features
		if (!$.isFunction($.fn.autosize))
			this.options.expandingTextAreas = false;
		
		if (typeof(this.options.schema) != 'function') {
			// Turn relative paths into absolute paths for the sake of web workers
			var path_regx = /^https?:\/\/.*?\//;
			var matches = this.baseUrl.match(path_regx);

			// Turn relative paths into absolute paths for the sake of web workers
			if (libPath) {
				// Check for trailing slash. Add if needed, otherwise libPath breaks
				libPath = (/\/$/.test(libPath)) ? libPath : libPath + '/';

				if (!path_regx.test(libPath)) {
					if (libPath.indexOf('/') === 0) {
						this.libPath = matches[0] + libPath.substr(1, libPath.length);
					} else {
						this.libPath = this.baseUrl + libPath;
					}
				} else  {
					this.libPath = libPath;
				}
			} else {
				this.libPath = this.baseUrl + "lib/";
			}

			if ((typeof schema == 'string' || typeof schema instanceof String)) {
				// if http(s) just return the schema untouched
				if (!path_regx.test(schema)) {
					if (schema.indexOf('/') === 0) {
						// Relative to root
						this.options.schema = matches[0] + schema.substr(1, schema.length);
					} else {
						// Relative to current path
						this.options.schema = this.baseUrl + schema;
					}
				}
			}
		}

		// Check for default templates if no default retrieval path
		if (!this.options.templatePath) {
			this.loadSchema(this.options.schema);
		} else if (this.options.ajaxOptions.xmlRetrievalPath === null) {
			this._templating(this);
		} else {
			this.loadSchema(this.options.schema);
		}
	},
 
	_init: function() {
		if (this.options.submitButtonConfigs) {
			// User provided button configuration
			this.submitButtonConfigs = this.options.submitButtonConfigs;
		} else {
			// Simple button configuration, generate defaults
			var exporting = !this.options.ajaxOptions.xmlUploadPath;

			// Either an upload button or an export button
			this.submitButtonConfigs = [{
				url : this.options.ajaxOptions.xmlUploadPath,
				label : exporting? "Export" : "Submit changes",
				onSubmit : exporting? this.exportXML : null,
				disabled : typeof(Blob) === undefined && exporting
			}];
		}

		if (this.options.submitErrorHandler == null) {
			this.options.submitErrorHandler = function(jqXHR, exception) {
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
			};
		}

		// Retrieve the local xml content before we start populating the editor.
		var localXMLContent = null;
		if (this.element.is("textarea")) {
			// Editor initialized on a text area.  Move text area out of the way and hide it
			// so that it can be updated with document changes.
			this.isTextAreaEditor = true;
			// Capture the existing value in the text area in case we are using a local document
			// Retrieving text instead of val because of firefox inconsistencies
			localXMLContent = this.element.text();
			this.xmlEditorContainer = $("<div/>").attr('class', xmlEditorContainerClass);
			$(this.element)
				.before(this.xmlEditorContainer)
				.hide();
		} else {
			if (this.element.children().length > 0) {
				// If the content is embedded as part of the html, retrieve it as such.
				// Note, this is case insensitive and can leave to problems
				localXMLContent = this.element.html();
			} else {
				// Content is probably XML encoded
				localXMLContent = this.element.text();
			}
			
			// Clear out the contents of the element being initialized on
			this.element.text("");
			
			// Add the editor into the dom
			this.xmlEditorContainer = $("<div/>").attr('class', xmlEditorContainerClass).appendTo(this.element);
		}
		this.xmlState = null;
		this.xmlWorkAreaContainer = null;
		this.xmlTabContainer = null;
		
		this.editorHeader = null;
		this.problemsPanel = null;
		
		this.guiEditor = new GUIEditor(this);
		this.textEditor = new TextEditor(this);
		this.activeEditor = this.guiEditor;
		
		var self = this;
		
		this.menuBar = new MenuBar(this);
		this.menuBar.updateFunctions.push(this.refreshMenuUndo);
		this.menuBar.updateFunctions.push(this.refreshMenuSelected);
		if (this.options.menuEntries) {
			$.each(this.options.menuEntries, function() {
				self.menuBar.addEntry(this);
			});
		}
		this.modifyMenu = new ModifyMenuPanel(this);
		
		if (this.options.confirmExitWhenUnsubmitted) {
			$(window).bind('beforeunload', function(e) {
				if (self.xmlState != null && self.xmlState.isChanged()) {
					return "The document contains unsaved changes.";
				}
			});
		}
		
		this.loadDocument(this.options.ajaxOptions, localXMLContent);
	},
	
	// Load the schema object
	loadSchema: function(schema) {
		var self = this;
		// If the schema is a function, execute it to get the schema from it.
		if (jQuery.isFunction(schema)) {
			this.schema = schema.apply();
			self._schemaReady();
		} else {
			// Load schema in separate thread for browsers tha support it.  IE10 blocked to avoid security error
			if (this.options.loadSchemaAsychronously && !window.MSBlobBuilder
					&& typeof(window.URL) !== "undefined" && typeof(Worker) !== "undefined" && typeof(Blob) !== "undefined") {
				var blob = new Blob([
						"self.onmessage = function(e) {" +
						"importScripts(e.data.libPath + 'cycle.js');" +
						"var schema;" +
						"if (typeof e.data.schema == 'string' || typeof e.data.schema instanceof String) {" +
						"	var xmlhttp = new XMLHttpRequest();" +
						"	xmlhttp.onreadystatechange = function() {" +
						"		if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {" +
						"			schema = eval('(' + xmlhttp.responseText + ')');" +
						"			self.postMessage(JSON.retrocycle(schema));" +
						"		}" +
						"	};" +
						"	xmlhttp.open('GET', e.data.schema, true);" +
						"	xmlhttp.send();" +
						"} else {" +
						"	schema = JSON.retrocycle(e.data.schema);" +
						"	self.postMessage(schema);" +
						"}" +
						"}"
				], { type: "text/javascript" });
				var worker = new Worker(window.URL.createObjectURL(blob));
				worker.onmessage = function(e) {
					self.schema = e.data;
					self._schemaReady();
					worker.terminate();
				};
				worker.onerror = function(e) {
					self.schema = JSON.retrocycle(schema);
					self._schemaReady();
				};
				worker.postMessage({'schema' : schema, 'libPath' : this.libPath});
			} else {
				// Fallback with synchronous retrocycling
				if (typeof schema == 'string' || typeof schema instanceof String) {
					$.ajax({
						url : schema,
						async : self.options.loadSchemaAsynchronously,
						dataType : 'json',
						success : function(data) {
							self.schema = JSON.retrocycle(data);
							self._schemaReady();
						}
					});
				} else {
					self.schema = JSON.retrocycle(schema);
					self._schemaReady();
				}
			}
		}
	},
	
	// Load the XML document for editing
	loadDocument: function(ajaxOptions, localXMLContent) {
		if (ajaxOptions != null && ajaxOptions.xmlRetrievalPath != null) {
			var self = this;
			$.ajax({
				type : "GET",
				url : ajaxOptions.xmlRetrievalPath,
				data : (ajaxOptions.xmlRetrievalParams),
				dataType : "text",
				success : function(data) {
					if (!self.options.templatePath || $(data).children().length) {
						self._documentReady(data);
					} else {
						// Check for templates if XML retrieval path is set.
						self._templating(self);
					}
				}
			});
		} else {
			this._documentReady(localXMLContent);
		}
	},

	_templating : function(self) {
		self.template = new XMLTemplates(self);

		if (self.options.defaultTemplate) {
			self.template.loadSelectedTemplate(self.options.defaultTemplate, self);
		} else {
			self.template.templateForm();
			self.template.createDialog();
		}
	},

	// XML Document loaded event
	_documentReady : function(xmlString) {
		var self = this;

		this.xmlState = new DocumentState(xmlString, this);
		this.xmlState.extractNamespacePrefixes();
		this.undoHistory = new UndoHistory(this.xmlState, this);
		this.undoHistory.setStateChangeEvent(function() {
			self.refreshDisplay();
		});
		this._documentAndSchemaReady();
	},
	
	// Schema object loaded event
	_schemaReady : function() {
		if (!this.options.targetNS) {
			this.targetNS = this.schema.namespace;
		}
		this.schemaTree = new SchemaTree(this.schema);
		this.schemaTree.build();
		this._documentAndSchemaReady();
	},
	
	// Performs initialization of editor after rejoining document and schema loading workflows
	// to support asychronous/multithreaded loading 
	_documentAndSchemaReady : function() {
		// Join back up asynchronous loading of document and schema
		if (!this.schemaTree || !this.xmlState)
			return;

		this.targetPrefix = this.xmlState.namespaces.getNamespacePrefix(this.options.targetNS);
		
		this.constructEditor();
		this.refreshDisplay();
		this.activeEditor.selectRoot();
		// Capture baseline undo state
		this.undoHistory.captureSnapshot();
	},
	
	// Construct user interface components of the editor
	constructEditor: function() {
		// Work Area
		this.xmlWorkAreaContainer = $("<div/>").attr('class', xmlWorkAreaContainerClass).appendTo(this.xmlEditorContainer);
		
		// Menu bar
		var editorHeaderBacking = $("<div/>").addClass(editorHeaderClass + "_backing").appendTo(this.xmlWorkAreaContainer);
		this.editorHeader = $("<div/>").attr('class', editorHeaderClass).appendTo(this.xmlWorkAreaContainer);
		if (this.options.documentTitle != null)
			$("<h2/>").html("Editing Description: " + this.options.documentTitle).appendTo(this.editorHeader);
		this.menuBar.render(this.editorHeader);
		editorHeaderBacking.height(this.editorHeader.outerHeight());
		// Create grouping of header elements that need to be positioned together
		this.editorHeaderGroup = this.editorHeader.add(editorHeaderBacking);
		
		this.xmlTabContainer = $("<div/>").attr("class", editorTabAreaClass).css("padding-top", this.editorHeader.height() + "px").appendTo(this.xmlWorkAreaContainer);
		this.problemsPanel = $("<pre/>").attr('class', problemsPanelClass).hide().appendTo(this.xmlTabContainer);
		
		this.guiEditor.initialize(this.xmlTabContainer);
		this.modeChange(0);
		
		var self = this;
		$(window).resize($.proxy(this.resize, this));
		
		this.modifyMenu.initialize(this.xmlEditorContainer);
		this.modifyMenu.addMenu(addElementMenuClass, this.options.addElementMenuHeaderText, 
				true, false, true);
		this.modifyMenu.addAttributeMenu(addAttrMenuClass, this.options.addAttrMenuHeaderText, 
				true, false, true);
		this.modifyMenu.addNodeMenu(addNodeMenuClass, "Add Nodes", true, false);
		this.addTopLevelMenu = this.modifyMenu.addMenu(addTopMenuClass, this.options.addTopMenuHeaderText, 
				true, true, false, function(target) {
			var selectedElement = self.guiEditor.selectedElement;
			if (!selectedElement || selectedElement.length == 0 || selectedElement.isRootElement) 
				return null;
			var currentElement = selectedElement;
			while (currentElement.parentElement != null) {
				if (currentElement.parentElement.isRootElement)
					break;
				currentElement = currentElement.parentElement;
			}
			if (currentElement != null)
				return currentElement;
			return null;
		}).populate(this.guiEditor.rootElement);
		
		this.setEnableKeybindings(this.options.enableGUIKeybindings);
		if (this.options.floatingMenu) {
			$(window).bind('scroll', $.proxy(this.modifyMenu.setMenuPosition, this.modifyMenu));
		}

		this.ready = true;
	},
	
	// Resize event for refreshing menu and editor sizes
	resize: function () {
		this.xmlTabContainer.width(this.xmlEditorContainer.outerWidth() - this.modifyMenu.menuColumn.outerWidth());
		if (this.activeEditor != null){
			this.activeEditor.resize();
		}
		this.editorHeader.width(this.xmlTabContainer.width());
		if (this.options.floatingMenu) {
			this.modifyMenu.setMenuPosition();
		}
	},
	
	// Event which triggers the creation of a new child element, as defined by an instigator such as a menu
	addChildElementCallback: function (instigator, relativeTo, prepend) {
		if ($(instigator).hasClass("disabled"))
			return;
		var xmlElement = $(instigator).data("xml").target;
		var objectType = $(instigator).data("xml").objectType;
		
		this.addChildElement(xmlElement, objectType, relativeTo, prepend);
	},

	addChildElement: function(parentElement, newElementDefinition, relativeTo, prepend) {
		if (!parentElement.allowChildren)
			return null;

		// If in the text editor view, synchronous the text to the xml model and ensure wellformedness
		if (this.textEditor.active) {
			if (this.xmlState.changesNotSynced()) {
				try {
					this.setXMLFromEditor();
				} catch (e) {
					this.addProblem("Unable to add element, please fix existing XML syntax first.", e);
					return;
				}
			}
		}

		var objectType;
		if (typeof newElementDefinition == 'string' || newElementDefinition instanceof String) {
			var defs = parentElement.objectType.elements;
			
			for (var index in defs)  {
				var definition = defs[index];
				var elementName = this.xmlState.getNamespacePrefix(definition.namespace) 
						+ definition.localName;
				if (elementName == newElementDefinition) {
					objectType = definition;
					break;
				}
			}

			// No matching child definition and parent doesn't allow "any", so can't add child
			if (!objectType && !parentElement.objectType.any) {
				return "Could not add child " + newElementDefinition + ", it is not a valid child of " + parentElement.objectType.localName;
			}
		} else {
			objectType = newElementDefinition;
		}

		// Create the new element as a child of its parent
		var newElement;
		if (objectType) {
			// Determine if it is valid to add this child element to the given parent element
			if (!parentElement.childCanBeAdded(objectType))
				return;
			
			// Add the namespace of the new element to the root if it is not already present
			this.xmlState.addNamespace(objectType);
			newElement = parentElement.addElement(objectType, relativeTo, prepend);
		} else {
			var nameParts = newElementDefinition.split(":");
			this.xmlState.addNamespace(nameParts.length > 1? nameParts[0] : "");
			newElement = parentElement.addNonschemaElement(newElementDefinition, relativeTo, prepend);
		}
		
		if (newElement == null) {
			return "Failed to add child of type " + newElementDefinition;
		}
		
		// Trigger post element creation event in the currently active editor to handle UI updates
		this.activeEditor.addElementEvent(parentElement, newElement);

		return newElement;
	},
	
	// Event which adds an attribute to an element, as defined by an instigator such as a menu
	addAttributeButtonCallback: function(instigator) {
		if ($(instigator).hasClass("disabled"))
			return;
		// Create attribute on the targeted parent, and add its namespace if missing
		var data = $(instigator).data('xml');

		return this.addAttribute(data.target, data.objectType, instigator);
	},

	addAttribute: function(xmlElement, attrDefinition, instigator) {

		// Synchronize xml document if there are unsynchronized changes in the text editor
		if (this.xmlState.changesNotSynced()) {
			try {
				this.setXMLFromEditor();
			} catch (e) {
				alert(e.message);
				return;
			}
		}

		var objectType;
		if ($.type(attrDefinition) === "object") {
			objectType = attrDefinition;
		} else {
			var defs = xmlElement.objectType.attributes;
			
			for (var index in defs)  {
				var definition = defs[index];
				var attrName = this.xmlState.getNamespacePrefix(definition.namespace) 
						+ definition.localName;
				if (attrName == attrDefinition) {
					objectType = definition;
					break;
				}
			}

			if (!objectType && !xmlElement.objectType.anyAttribute) {
				return "Could not add attribute " + attrDefinition + ", it is not a valid for element " + xmlElement.objectType.localName;
			}
		}

		var newAttr;
		if (objectType) {
			this.xmlState.addNamespace(objectType);
			newAttr = xmlElement.addAttribute(objectType);
		} else {
			var nameParts = attrDefinition.split(":");
			if (nameParts.length > 1)
				this.xmlState.addNamespace(nameParts[0]);
			newAttr = xmlElement.addAttribute({
				attribute : true,
				localName : attrDefinition
			});
			//newAttr = xmlElement.addNonschemaAttribute(newElementDefinition);
		}

		// Inform the active editor of the newly added attribute
		this.activeEditor.addAttributeEvent(xmlElement, newAttr, $(instigator));

		return newAttr;
	},

	addNodeCallback: function(instigator, nodeType, prepend) {
		if ($(instigator).hasClass("disabled"))
			return;

		var data = $(instigator).data('xml');

		this.addNode(data.target, nodeType, prepend);
	},

	addNode: function(parentElement, nodeType, prepend, relativeTo) {

		// Synchronize xml document if there are unsynchronized changes in the text editor
		if (this.xmlState.changesNotSynced()) {
			try {
				this.setXMLFromEditor();
			} catch (e) {
				alert(e.message);
				return;
			}
		}

		if (!(parentElement instanceof XMLElement)) {
			return;
		}

		// Create node on the targeted parent
		var nodeObject = parentElement.addNode(nodeType, prepend, relativeTo);
		// Inform the active editor of the newly added attribute
		if (nodeObject) {
			this.guiEditor.selectNode(nodeObject);
			this.activeEditor.addNodeEvent(parentElement, nodeObject);
			nodeObject.focus();
		}
	},

	// Adds an element stub either as a child of an element which allows children, or 
	// as a sibling
	addNextElement : function(xmlElement, prepend) {
		if (xmlElement.allowChildren) {
			this.addNode(xmlElement, "element", prepend);
		} else {
			this.addNode(xmlElement.parentElement, "element", prepend, xmlElement);
		}
	},

	// Triggered when a document has been loaded or reloaded
	documentLoadedEvent : function(newDocument) {
		if (this.guiEditor != null && this.guiEditor.rootElement != null)
			this.guiEditor.rootElement.xmlNode = newDocument.children().first();
		if (this.problemsPanel != null)
			this.clearProblemPanel();
	},
	
	// Switch the currently active editor to the editor identified
	modeChange: function(mode) {
		// Can't change mode to current mode
		if ((mode == 0 && this.guiEditor.active) || (mode == 1 && this.textEditor.active))
			return this;
			
		if (mode == 0) {
			$("*:focus").blur();
			$(".xml_editor_container *:focus").blur();

			if (this.textEditor.isInitialized() && this.xmlState.isChanged()) {
				// Try to reconstruct the xml object before changing tabs.
				this.setXMLFromEditor();
				this.undoHistory.captureSnapshot();
			}
		}
		
		$(".active_mode_tab").removeClass("active_mode_tab");
		this.modifyMenu.clearContextualMenus();
		if (this.activeEditor != null) {
			this.activeEditor.deactivate();
		}
		if (mode == 0) {
			this.activeEditor = this.guiEditor;
			$("#" + xmlMenuHeaderPrefix + this.options.xmlEditorLabel.replace(/ /g, "_")).addClass("active_mode_tab");
		} else {
			this.activeEditor = this.textEditor;
			$("#" + xmlMenuHeaderPrefix + this.options.textEditorLabel.replace(/ /g, "_")).addClass("active_mode_tab");
		}
		this.activeEditor.activate();
		if (this.ready)
			this.resize();
		return this;
	},
	
	refreshDisplay: function() {
		if (this.activeEditor == null)
			return;
		this.activeEditor.refreshDisplay();
		
		if (this.options.floatingMenu) {
			this.modifyMenu.setMenuPosition();
		}
		this.xmlWorkAreaContainer.width(this.xmlEditorContainer.outerWidth() - this.modifyMenu.menuColumn.outerWidth());
	},
	
	setTextArea : function(xmlString) {
		if (this.isTextAreaEditor)
			this.element.val(xmlString);
	},
	
	// Refresh the state of the XML document from the contents of text editor 
	setXMLFromEditor: function() {
		var xmlString = this.textEditor.aceEditor.getValue();
		this.xmlState.setXMLFromString(xmlString);
		if (this.guiEditor.isActive) {
			this.guiEditor.setRootElement(this.xmlState.xml.children()[0]);
			this.addTopLevelMenu.populate(this.guiEditor.rootElement)
		}
	},
	
	// Callback for submit button pressing.  Performs a submit function and then uploads the 
	// document to the provided URL, if configured to do either
	submitXML: function(config) {
		if (config.onSubmit) {
			config.onSubmit.call(this, config);
		}

		if (config.url) {
			this.uploadXML(config);
		}
	},
	
	// Export the contents of the editor as text to a file, as supported by browsers
	exportXML: function() {
		if (typeof(Blob) === "undefined") {
			this.addProblem("Browser does not support saving files via this editor.  To save, copy and paste the document from the Text view.");
			return false;
		}
		
		var exportDialog = $("<form><input type='text' class='xml_export_filename' placeholder='file.xml'/><input type='submit' value='Export'/></form>")
				.dialog({modal: true, dialogClass: 'xml_dialog', resizable : false, title: 'Enter file name', height: 80});
		var self = this;
		exportDialog.submit(function(){
			if (self.textEditor.active) {
				try {
					self.setXMLFromEditor();
				} catch (e) {
					self.xmlState.setDocumentHasChanged(true);
					$("." + submissionStatusClass).html("Failed to save<br/>See errors at top").css("background-color", "#ffbbbb").animate({backgroundColor: "#ffffff"}, 1000);
					self.addProblem("Cannot save due to invalid xml", e);
					return false;
				}
			}
			var xmlString = self.xml2Str(self.xmlState.xml);
			var blob = new Blob([xmlString], { type: "text/xml" }); 
			var url = URL.createObjectURL(blob);
			
			exportDialog.dialog('option', 'title', '');
			var fileName = exportDialog.find('input[type="text"]').val();
			if (!fileName)
				fileName = "file.xml";
			var download = $('<a>Download ' + fileName + '</a>').attr("href", url);
			download.attr("download", fileName);
			exportDialog.empty().append(download);
			return false;
		});
	},

	// Upload the contents of the editor to a path
	uploadXML: function(config) {
		if (!config || !config.url) {
			if (this.submitButtonConfigs.length > 0 && this.submitButtonConfigs[0].url) {
				config = this.submitButtonConfigs[0];
			} else {
				this.addProblem("Cannot submit because no post Options");
				return;
			}
		}

		if (this.textEditor.active) {
			try {
				this.setXMLFromEditor();
			} catch (e) {
				this.xmlState.setDocumentHasChanged(true);
				$("." + submissionStatusClass).html("Failed to submit<br/>See errors at top").css("background-color", "#ffbbbb").animate({backgroundColor: "#ffffff"}, 1000);
				this.addProblem("Cannot submit due to invalid xml", e);
				return false;
			}
		}
		// convert XML DOM to string
		var xmlString = this.xml2Str(this.xmlState.xml);
		$("." + submissionStatusClass).html("Submitting...");
		var self = this;
		$.ajax({
			url : config.url,
			contentType : "application/xml",
			type : "POST",
			data : xmlString,
			success : function(response) {
				// Process the response from the server using the provided response handler
				// If the result of the handler evaluates true, then it is assumed to be an error
				var outcome = config.responseHandler(response);

				if (!outcome) {
					self.xmlState.changesCommittedEvent();
					self.clearProblemPanel();
				} else {
					self.xmlState.syncedChangeEvent();
					$("." + submissionStatusClass).html("Failed to submit<br/>See errors at top").css("background-color", "#ffbbbb").animate({backgroundColor: "#ffffff"}, 1000);
					self.addProblem("Failed to submit xml document", outcome);
				}
			},
			error : function(jqXHR, exception) {
				if (config.errorHandler) {
					config.errorHandler(jqXHR, exception);
					return;
				}

				self.options.submitErrorHandler(jqXHR, exception);
			}
		});
	},
	
	// Default server submission response parser, mostly for reference.  
	swordSubmitResponseHandler: function(response) {
		var responseObject = $(response);
		if (responseObject.length > 0 && localName(responseObject[responseObject.length - 1]) == "sword:error") {
			return responseObject.find("atom\\:summary").html();
		}
		return false;
	},

	// Serializes the provided xml node into a string
	xml2Str: function(xmlNodeObject) {
		if (xmlNodeObject == null)
			xmlNodeObject = this.xmlState.xml;
		var xmlNode = (xmlNodeObject instanceof jQuery? xmlNodeObject[0]: xmlNodeObject);
		var xmlStr = "";
		if (this.options.prettyXML) {
			return formatXML(xmlNode);
		} else {
			try {
				// Gecko-based browsers, Safari, Opera.
				return (new XMLSerializer()).serializeToString(xmlNode);
			} catch (e) {
				try {
					// Internet Explorer.
					return xmlNode.xml;
				} catch (e) {
					this.addProblem('Xmlserializer not supported', e);
					return false;
				}
			}
		}
	},
	
	// Add a error/problem message to the error display
	addProblem: function(message, problem) {
		this.problemsPanel.html(message + "<br/>");
		if (problem !== undefined) {
			if (problem.substring) {
				this.problemsPanel.append(problem.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
			} else {
				this.problemsPanel.append(problem.message.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
			}
		}
		console.error(problem);
		this.refreshProblemPanel();
	},
	
	// Clear the listing of errors
	clearProblemPanel: function() {
		this.problemsPanel.hide();
	},
	
	// Update whether or not the error panel is displayed
	refreshProblemPanel: function() {
		if (this.problemsPanel.html() == "") {
			this.problemsPanel.hide("fast");
		} else {
			this.problemsPanel.show("fast");
		}
	},

	// Performs an equality comparison between two nodes, returning true if they match namespace uri and element name
	nsEquals: function(node, element, elementNS) {
		if (element.substring)
			return element == localName(node) && elementNS == node.namespaceURI;
		return localName(element) == localName(node) && node.namespaceURI == element.namespace;
	},
	
	// Strips the namespace prefix off an element name
	stripPrefix: function(name) {
		var index = name.indexOf(":");
		return index == -1? name: name.substring(index + 1);
	},
	
	setEnableKeybindings : function(enable) {
		if (enable) {
			this.options.enableGUIKeybindings = true;
			this.menuBar.menuBarContainer.removeClass("xml_bindings_disabled");
			$(window).on("keydown.xml_keybindings", $.proxy(this.keydownCallback, this));
		} else {
			this.options.enableGUIKeybindings = false;
			this.menuBar.menuBarContainer.addClass("xml_bindings_disabled");
			$(window).off("keydown.xml_keybindings");
		}
	},

	getFocusedInput: function() {
		return $("input:focus, textarea:focus, select:focus");
	},
	
	// Initialize key bindings
	keydownCallback: function(e) {
		var prepend = this.options.prependNewElements ^ e.shiftKey;

		if (this.guiEditor.active) {
			var focused = this.getFocusedInput();
			
			// Escape key, blur the currently selected input or deselect selected element
			if (e.which == 27) {
				if (focused.length > 0) {
					focused.blur();
				} else this.guiEditor.selectNode(null);
				return false;
			}
			
			// Tab, select the next input
			if (e.which == 9) {
				e.preventDefault();
				this.guiEditor.focusInput(e.shiftKey);
				return false;
			}
			
			// Delete key press while item selected but nothing is focused.
			if (e.which == 46 && focused.length == 0) {
				this.guiEditor.deleteSelected();
				return false;
			}
			
			if (e.which > 36 && e.which < 41){
				if (e.altKey && (focused.length == 0 || focused.is("textarea"))) {
					e.preventDefault();
					// Alt + up or down move the element up and down in the document
					this.guiEditor.moveSelected(e.which == 38);
					if (focused.is("textarea"))
						focused.focus();
					return false;
				}
				if (focused.length == 0) {
					e.preventDefault();
					if (e.shiftKey) {
						// If holding shift while pressing up or down, then jump to the next/prev sibling
						if (e.which == 40 || e.which == 38) {
							this.guiEditor.selectSibling(e.which == 38);
						} else if (e.which == 37 || e.which == 39) {
							this.guiEditor.selectParent(e.which == 39);
						}
					} else {
						// If not holding shift while hitting up or down, go to the next/prev element
						if (e.which == 40 || e.which == 38){
							this.guiEditor.selectNext(e.which == 38);
						} else if (e.which == 37 || e.which == 39) {
							this.guiEditor.selectAttribute(e.which == 37);
						}
					}
				}
				return true;
			}
			
			if ((e.metaKey || e.ctrlKey) && focused.length == 0 && e.which == 'Z'.charCodeAt(0)) {
				// Undo
				this.undoHistory.changeHead(e.shiftKey? 1: -1);
				return false;
			} else if ((e.metaKey || e.ctrlKey) && focused.length == 0 && e.which == 'Y'.charCodeAt(0)){
				// Redo
				this.undoHistory.changeHead(1);
				return false;
			}
		}
		
		if (e.altKey && e.ctrlKey) {
			// Save, on either tab.
			if (e.which == 'S'.charCodeAt(0)) {
				$("." + submitButtonClass).click();
				return false;
			}
			
			if (e.which == 'E'.charCodeAt(0)) {
				this.exportXML();
				return false;
			}
			
			// Switch to the GUI editor
			if (e.which == '1'.charCodeAt(0)) {
				this.modeChange(0);
				return false;
			}
			
			// Switch to the text editor
			if (e.which == '2'.charCodeAt(0)) {
				this.modeChange(1);
				return false;
			}
		}

		if (this.guiEditor.active) {
			var selected = this.guiEditor.selectedElement;

			// Enter, contextual adding
			if (e.which == 13) {
				var focused = this.getFocusedInput();
				if (focused.length == 0 || e.altKey) {
					if (selected instanceof XMLElement) {
						this.addNextElement(selected, e.shiftKey);
					} else if (selected instanceof XMLElementStub 
							|| selected instanceof XMLAttributeStub) {
						selected.create();
					}
					e.preventDefault();
					return false;
				}
				return true;
			}

			if (e.altKey) {
				if (e.which == 'E'.charCodeAt(0)) {
					if (selected instanceof XMLElement && selected.allowChildren)
						this.addNode(selected, "element", prepend);
					return false;
				}

				if (e.which == 'S'.charCodeAt(0)) {
					if (selected)
						this.addNode(selected.parentElement, "element", prepend, selected);
					return false;
				}

				if (e.which == 'P'.charCodeAt(0)) {
					if (selected && selected.parentElement.objectType)
						this.addNode(selected.parentElement, "element", prepend);
					return false;
				}

				if (e.which == 'R'.charCodeAt(0)) {
					this.addNode(this.guiEditor.rootElement, "element", prepend);
					return false;
				}

				if (e.which == 'A'.charCodeAt(0)) {
					if (selected)
						this.addNode(selected, "attribute", prepend);
					return false;
				}

				if (e.which == 'T'.charCodeAt(0)) {
					if (selected)
						this.addNode(selected, "text", prepend);
					return false;
				}

				if (e.which == 191) {
					if (selected)
						this.addNode(selected, "comment", prepend);
					return false;
				}

				if (e.which == 188) {
					if (selected)
						this.addNode(selected, "cdata", prepend);
					return false;
				}
			}
		}
		
		return true;
	},
	
	// Menu Update functions
	refreshMenuUndo: function(self) {
		if (self.undoHistory.headIndex > 0) {
			$("#" + xmlMenuHeaderPrefix + "Undo").removeClass("disabled").data("menuItemData").enabled = true;
		} else {
			$("#" + xmlMenuHeaderPrefix + "Undo").addClass("disabled").data("menuItemData").enabled = false;
		}
		if (self.undoHistory.headIndex < self.undoHistory.states.length - 1) {
			$("#" + xmlMenuHeaderPrefix + "Redo").removeClass("disabled").data("menuItemData").enabled = true;
		} else {
			$("#" + xmlMenuHeaderPrefix + "Redo").addClass("disabled").data("menuItemData").enabled = false;
		}
	},
	
	// Performs updates to the menu for changing element/attribute selection
	refreshMenuSelected: function(self) {
		var suffixes = ['Deselect', 'Next_Element', 'Previous_Element', 'Parent', 'First_Child', 'Next_Sibling', 
						'Previous_Sibling', 'Next_Attribute', 'Previous_Attribute', 'Delete', 'Move_Element_Up', 
						'Move_Element_Down'];
		var hasSelected = self.guiEditor.selectedElement != null && self.guiEditor.active;
		$.each(suffixes, function(){
			if (hasSelected)
				$("#" + xmlMenuHeaderPrefix + this.toString()).removeClass("disabled").data("menuItemData").enabled = true;
			else $("#" + xmlMenuHeaderPrefix + this.toString()).addClass("disabled").data("menuItemData").enabled = false;
		});
	}
});
