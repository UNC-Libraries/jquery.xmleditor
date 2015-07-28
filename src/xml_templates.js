/**
 * Create class to focus, select and load default XML templates
 * @param init_object
 * @constructor
 */
function XMLTemplates(init_object) {
    this.template_path = init_object.options.templateOptions.templatePath;
    this.templates = init_object.options.templateOptions.templates;
    this.editor = init_object;
    this.extension_regx = /\.\w{3,}$/;
}

XMLTemplates.prototype.constructor = XMLTemplates;

XMLTemplates.prototype.createChooseTemplate = function() {
    this.templateForm();
    this.createDialog();
    this.loadEvents();
};

/**
 * Load the dialog form for user to select a template from a list of provided templates
 * @returns {*|jQuery}
 */
XMLTemplates.prototype.createDialog = function() {
    var self = this;
    var buttons = {};
    if (self.editor.options.templateOptions.cancelFunction) {
        buttons["Cancel"] = $.proxy(self.editor.options.templateOptions.cancelFunction, self);
    }
    buttons["Choose"] = function() {
        self.processForm();
    };

    this.form.dialog({
        autoOpen: true,
        dialogClass: "jquery-editor-no-close template-form",
        height: 350,
        width: 500,
        modal: true,
        buttons: buttons
    });
};

/**
 * Create form & add to DOM
 * Don't think we can assume user will build this form themselves
 */
XMLTemplates.prototype.templateForm = function() {
    var form = '<div class="template-form" title="Choose Template">' +
        '<ul>';

    for(var i=0; i<this.templates.length; i++) {
        var current = this.templates[i];

        form += '<li class="templating"'  + ' id="template_' + i + '">' +
            '<a href="' + current.filename + '">';

        if (current.icon_url) {
           form += '<img class="' + current.icon_class + '" src="' + current.icon_url + '"/> ';
        }

        if (current.icon_class) {
           form += '<i class="' + current.icon_class + '"></i> ';
        }
        form += '<div>';
        form += current.title? current.title : current.filename;

        if (current.description) {
            form += '<span>' + current.description + '</span>';
        }

        form += '</div>';

        form += '</a>' +
            '</li>';
    }

    form += '</ul>' +
        '</div>';

    this.form = $(form);
    this.form.insertAfter("body");
    $('li:first', this.form).addClass('focus');
};

/**
 * Select a template from the form
 * @param dialog
 * @param self
 */
XMLTemplates.prototype.processForm = function() {
    // Split on mdash if description present
    var selection = $(".focus a", this.form).attr('href');

    this.form.dialog("close");
    this.loadSelectedTemplate(selection);
};

/**
 * Load selected template.
 * @param selection
 * @param self
 */
XMLTemplates.prototype.loadSelectedTemplate = function(selection) {
    var self = this;
    // Default template loading doesn't have access to xml_templates constructor
    $.ajax({
        url: this.template_path + selection,
        dataType: "xml"
    }).done(function(data) {
        var xml_string = self.editor.xml2Str(data);
        self.editor._documentReady(xml_string);
    }).fail(function(jqXHR, textStatus) {
        alert("Unable to load the requested template: " + textStatus);
    });
};

/**
 * Highlight and focus currently selected template
 * If enter hit go ahead and load focused template
 * @param dialog
 */
XMLTemplates.prototype.focusTemplate = function() {
    var self = this;

    // Focus selected template
    this.form.on('keydown click', '.templating', function(e) {

        e.preventDefault();
        var key = e.which;
        var number_of_forms, base_element, current, form_id, next_element;

        if (key === 1 || key === 9) {
            number_of_forms = $('.templating').length;

            // Left click, select the clicked target
            if (key == 1) {
                base_element = $(e.target);
                if (!base_element.hasClass("templating")) {
                    base_element = base_element.parent(".templating");
                }
            } else {
                current = $('.focus', self.form).attr('id');
                form_id = parseInt(current.slice(-1)) + 1;
                next_element = (form_id === number_of_forms) ? 0 : form_id;
                base_element = $('#template_' + next_element);
            }

            $('.templating', self.form).removeClass('focus');
            base_element.addClass('focus').focus();
        }

        // Load currently focused form if enter or escape is hit
        if (key == 13 || key == 27) {
            self.processForm();
        }
    });
};

/**
 * Load a template by double clicking it.
 * @param dialog
 */
XMLTemplates.prototype.loadEvents = function(dialog) {
    var self = this;

    this.focusTemplate();

    this.form.on('dblclick', function() {
        self.processForm();
    });
};
