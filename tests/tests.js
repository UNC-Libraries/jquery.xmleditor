$(function() {
  var runTest = function(name) {
    var schema = new Xsd2Json('schema.xsd', {schemaURI: name + '/'}).getSchema()();
    var rawExpectedSchema;
    $.ajax({
      url: name + '/schema.json',
      async: false
    }).done(function(data) {
      rawExpectedSchema = data;
    });
    var expectedSchema = JSON.retrocycle(rawExpectedSchema);
    if (!_.isEqual(schema, expectedSchema)) {
      console.log(name, 'result', schema, 'expected', expectedSchema);
      throw Error('Wrong result schema');
    }
  };
  var getTestcases = function() {
    var responseData;
    $.ajax({
      url: 'tests.json',
      async: false
    }).done(function(data) {
      responseData = data;
    });
    return responseData.testcases;
  };
  var buildTestcasesTable = function(testcases) {
    testcases.forEach(function(name) {
      var tr = $('<tr><th><a target="_blank" href="#"></a></th><td></td></tr>');
      var a = tr.find('a');
      a.text(name);
      var m = name.match(/^issue-([0-9]+)/);
      if (m !== null) {
        var issue = m[1];
        a.attr('href', 'https://github.com/UNC-Libraries/jquery.xmleditor/issues/' + issue);
      }
      tr.appendTo($('.testcases'));
    });
  };
  var main = function() {
    var testcases = getTestcases();
    var totalCount = testcases.length;
    var okCount = 0;
    $('.totalCount').text(totalCount);
    buildTestcasesTable(testcases);
    $('.testcases tr').each(function(i, tr) {
      var name = $(tr).find('a').text();
      var ok = false;
      var errorMessage = '';
      try {
        runTest(name);
        ok = true;
      } catch (e) {
        errorMessage = e.message;
      }
      $(tr).addClass(ok ? 'ok' : 'failure');
      $(tr).find('td').text(ok ? 'OK' : errorMessage);
      if (ok) {
        okCount++;
      }
    });
    var failCount = totalCount - okCount;
    $('.okCount').text(okCount);
    $('.failCount').text(failCount);
    $('.summary').addClass(failCount === 0 ? 'ok' : 'failure');
  };
  main();
});
