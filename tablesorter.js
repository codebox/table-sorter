function forEach(arr, fnDoThis){
    var len = arr.length, i;
    for (i=0; i < len; i++){
        fnDoThis(arr[i], i);
    }
}

function forEachObject(obj, fnDoThis){
	var item;
    for (item in obj){
        if (obj.hasOwnProperty(item)){
            fnDoThis(obj[item]);
        }
    }
}

var makeNumFromText = (function(){
	var regexNonNumeric = /[^0-9\.+\-]+/;
	return function(txt){
		return parseFloat(txt.replace(',', '').replace(regexNonNumeric, ' '));
	};
}());

function processAllTables(){
	forEach(document.getElementsByTagName("TABLE"), function(table){
	    processTable(table);
	});
}

function processTable(tableElement){
    var rowObjects = [], currentSortColIndex = null, currentSortAscending = null, linkTds = [], rowWithArrows, rowWithOptions, colCount = 0, sortTypes, currentSortType;

    if ( !checkTableStructureOk(tableElement) ){
        return;
    }

    sortTypes = {
        'NONE' : {
            'text' : 'none',
            'fn'   : sortRestore
        },
        'ALPHA' : {
            'text' : 'alpha',
            'fn'   : sortColByAlpha
        },
        'NUM' : {
            'text' : 'num',
            'fn'   : sortColByNum
        }
    };
    currentSortType = sortTypes.NONE;


    function sortRestore(){
        rowObjects.sort(function(a,b){
            return a.getOriginalIndex() - b.getOriginalIndex();
        });
        redraw();
    }

    function sortColByAlpha(col, ascending){
        if (col<colCount){
            var multiplier = ascending ? 1 : -1;
            rowObjects.sort(function(a,b){
                var aItem = a.getCellValue(col),
                	bItem = b.getCellValue(col);

                aItem = aItem ? aItem.toLowerCase() : aItem;
                bItem = bItem ? bItem.toLowerCase() : bItem;

                if (aItem){
                    if (bItem){
                        if (aItem > bItem){
                            return multiplier;
                        } else if (aItem < bItem){
                            return -1 * multiplier;
                        }
                        return 0;
                    }
                    return multiplier;

                }
                if (bItem){
                    return -1 * multiplier;
                }
                return 0;
            });
        }
        redraw();
    }

    function sortColByNum(col, ascending){
        var multiplier, aNum, bNum;
        if (col<colCount){
            multiplier = ascending ? 1 : -1;
            rowObjects.sort(function(a,b){
                aNum = makeNumFromText(a.getCellValue(col));
                if (isNaN(aNum)){
                 // Make non-numeric values go to the bottom of the list
                    return Infinity;
                }
                bNum = makeNumFromText(b.getCellValue(col));
                if (isNaN(bNum)){
                 // Make non-numeric values go to the bottom of the list
                    return -Infinity;
                }
                return (aNum - bNum) * multiplier;
            });
        }
        redraw();
    }

 // Populate rowObjects array
    forEach(tableElement.getElementsByTagName("TR"), function(item, i){
        var rowObject = buildRowObject(item, i);
        if (rowObject){
            rowObjects.push(rowObject);
            colCount = ( (colCount < rowObject.getCellCount()) ? rowObject.getCellCount() : colCount);
        }
    });

    setupSortRows();


    function checkTableStructureOk(tableElement){
     // tables that contain other tables are not processed...
         var rows, nestedTables = tableElement.getElementsByTagName("TABLE");
         if (nestedTables.length > 0){
             return false;
         }

     // tables that have less than 2 rows are not processed...
         rows = tableElement.getElementsByTagName("TR");
         if (rows.length < 2){
             return false;
         }

     // tables that don't have any text nodes are not processed...
          function checkForTextNodeChildren(item){
              var i, l, text, childNode, TEXT_NODE_TYPE = 3, childNodes = item.childNodes, TRIM_REGEX = /^\s+|\s+$/;

              if (!childNodes){
                  return false;
              }

              for (i=0, l=childNodes.length; i<l; i++) {
                  childNode = childNodes[i];
                  if (childNode.nodeType===TEXT_NODE_TYPE){
                      text = childNode.nodeValue;
                      text = text.replace(TRIM_REGEX, '');
                      if (text.length > 0){
                          return true;
                      }
                  } else {
                      if ( checkForTextNodeChildren(childNode) ){
                          return true;
                      }
                  }
              }
              return false;
          }
          if (!checkForTextNodeChildren(tableElement)){
              return false;
          }

        return true;
    }

    function buildRowObject(trElement, index){
    	var tdElements, obj = {}, parent = trElement.parentNode, cellToElementMappingArray = [], cellIndex=0;
        if (trElement.parentNode.tagName==='THEAD'){
         // Any rows inside a header are ignored
            return null;
        }

        tdElements = trElement.getElementsByTagName("TD");
        if (tdElements.length===0){
         // Rows without any TDs are ignored, these are usually headers with THs instead
            return null;
        }

        obj.getTr = function(){
            return trElement;
        };

     /* Produces a mapping from 'virtual' cells to TD elements
        so if the third cell has colspan='3' then virtual cells 2,3 and 4 all map to TD 2
         |A|B|  C  |
         [0,1,2,2,2] */
         forEach(tdElements, function(item, i){
            var j, colSpan = +(item.colSpan);
            if (isNaN(colSpan) || colSpan===0){
                colSpan = 1;
            }
            for(j=0; j<colSpan; j++){
                cellToElementMappingArray[cellIndex++] = i;
            }
         });

        obj.getCellCount = function(){
            return cellToElementMappingArray.length;
        };

        obj.getCellValue = function(index){
        	var tdIndex, cellContent, stripMarkupRegex;
            if (index >= cellToElementMappingArray.length){
                return null;
            }
            tdIndex = cellToElementMappingArray[index];

            cellContent = tdElements[tdIndex].innerHTML;
         // This might contain markup, eg <span class='tdText>cell text</span>, so clean it out
            stripMarkupRegex = /<[^<]*>/g;
            cellContent = cellContent.replace(stripMarkupRegex, '');

            return cellContent;
        };

        obj.getOriginalIndex = function(){
            return index;
        };

        obj.removeFromParent = function(){
            parent.removeChild(trElement);
        };

        obj.attachToParent = function(){
            parent.appendChild(trElement);
        };

        return obj;
    }

    function setSortType(sortType){
        currentSortType = sortType;

     // Adjust the styles of the sort-type links
        forEachObject(sortTypes, function(thisSortType){
            var isSelectedSortType = (thisSortType===currentSortType),
            	style = thisSortType.link.style;
            
            style.color          = (isSelectedSortType ? 'black' : 'gray');
            style.textDecoration = (isSelectedSortType ? '' : 'underline');
            style.cursor         = (isSelectedSortType ? '' : 'pointer'  );
        });
        
     // Hide the sort arrows if we aren't sorting
        rowWithArrows.style.display = (sortType===sortTypes.NONE) ? 'none' : '';
        
     // Reset any 'selected' arrow from the previous sort
        if (currentSortColIndex !== null){
            updateLinkCell(currentSortColIndex, false, false);
        }
    }

    function setupSortRows(){
    	var firstRow, optionsTd, optionsSpan, optionAlphaSortLink, optionNoSortLink, optionNumSortLink, linkTd, linkElement, i;

        firstRow = rowObjects[0].getTr();

     // Add a new row for the options
        rowWithOptions = document.createElement("TR");
        firstRow.parentNode.insertBefore(rowWithOptions, firstRow);

        optionsTd = document.createElement("TD");
        optionsTd.style.fontSize = '0.7em';
        optionsTd.colSpan        = colCount;

        optionsSpan = document.createElement("SPAN");
        optionsSpan.style.paddingLeft = '1em';
        optionsSpan.innerHTML         = 'Sort Type: ';

        optionAlphaSortLink = document.createElement("A");
        optionAlphaSortLink.style.paddingLeft    = '0.5em';
        optionAlphaSortLink.style.textDecoration = 'underline';
        optionAlphaSortLink.style.cursor         = 'pointer';
        optionAlphaSortLink.innerHTML            = 'alpha';
        optionAlphaSortLink.onclick = function(){
                    setSortType( sortTypes.ALPHA );
                };
        sortTypes.ALPHA.link = optionAlphaSortLink;

        optionNoSortLink = document.createElement("A");
        optionNoSortLink.style.paddingLeft    = '0.5em';
        optionNoSortLink.style.textDecoration = 'underline';
        optionNoSortLink.style.cursor         = 'pointer';
        optionNoSortLink.innerHTML            = 'none';
        optionNoSortLink.onclick = function(){
                    setSortType( sortTypes.NONE );
                    sortTypes.NONE.fn();
                };
        sortTypes.NONE.link = optionNoSortLink;

        optionNumSortLink = document.createElement("A");
        optionNumSortLink.style.paddingLeft    = '0.5em';
        optionNumSortLink.style.textDecoration = 'underline';
        optionNumSortLink.style.cursor         = 'pointer';
        optionNumSortLink.innerHTML            = 'num';
        optionNumSortLink.onclick = function(){
                    setSortType( sortTypes.NUM );
                };
        sortTypes.NUM.link = optionNumSortLink;

        optionsTd.appendChild(optionsSpan);
        optionsTd.appendChild(optionAlphaSortLink);
        optionsTd.appendChild(optionNumSortLink);
        optionsTd.appendChild(optionNoSortLink);
        rowWithOptions.appendChild(optionsTd);

     // Add a new row for the sort arrows
        rowWithArrows = document.createElement("TR");
        firstRow.parentNode.insertBefore(rowWithArrows, firstRow);
        for(i=0; i<colCount; i++){
            linkTd = document.createElement("TD");
            linkTd.style.fontSize   = '0.7em';
            linkTd.style.fontWeight = 'bold';
            linkTd.style.textAlign  = 'center';

            linkTds.push(linkTd);

            linkElement = document.createElement("A");
            linkTd.appendChild(linkElement);

            rowWithArrows.appendChild(linkTd);

            setCellImages(i, false, false);
         }

         setSortType(sortTypes.NONE);
    }

    function updateLinkCell(colIndex, isAscending, isDescending){
        if (currentSortColIndex === null){
         // No column is currently selected, so we don't need to reset anything
            setCellImages(colIndex, isAscending, isDescending);

        } else {
         // There is already a column selected
            if ( colIndex === currentSortColIndex){
             // The new column is the same as the current one...
                if (currentSortAscending !== null && ((currentSortAscending && isAscending) || (!currentSortAscending && isDescending))){
                     // The new sort order the the same as the current one, so do nothing
                } else {
                 // The column is the same, but the order is different
                    setCellImages(colIndex, isAscending, isDescending);
                }
            } else {
             // The new column is different to the current one so reset the current one
                setCellImages(currentSortColIndex, false, false);
             // Set up the new one
                setCellImages(colIndex, isAscending, isDescending);
            }
        }
    }

    function setCellImages(colIndex, isAscending, isDescending){
        var DATA_URL_UP         = "data:image/gif;base64,R0lGODlhCAAEAPcAAAAAAPfvc/8Avf///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////yH5BAEAAAIALAAAAAAIAAQAAAgSAAUIBABAoEGCBA8iTLhwYUAAADs=",
        	DATA_URL_UP_FADED   = "data:image/gif;base64,R0lGODlhCAAEAPcAAAAAAP8Avf///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////yH5BAEAAAEALAAAAAAIAAQAAAgWAAMIBABAoEEAAgQUHJgwYUGCECEGBAA7",
        	DATA_URL_DOWN       = "data:image/gif;base64,R0lGODlhCAAEAPcAAAAAAPfvc/8Avf///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////yH5BAEAAAIALAAAAAAIAAQAAAgTAAEIHChQAMGCAgwOTMgQoYCAAAA7",
        	DATA_URL_DOWN_FADED = "data:image/gif;base64,R0lGODlhCAAEAPcAAAAAAP8Avf///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////yH5BAEAAAEALAAAAAAIAAQAAAgXAAEIHCgwAAABCAUACMDwoEKGEAsyDAgAOw==",
        	linkCell = linkTds[colIndex],
        	upArrowImage, downArrowImage;

     // Remove the current images...
        while(linkCell.firstChild){
            linkCell.removeChild(linkCell.firstChild);
        }

        function setImageStyle(img){
        	img.style.cursor = 'pointer';
        	img.style.visibility = 'visible';
        }
        upArrowImage = document.createElement('IMG');
        upArrowImage.src = (isAscending ? DATA_URL_UP : DATA_URL_UP_FADED);
        setImageStyle(upArrowImage);
        upArrowImage.onclick = function(){
                    updateLinkCell(colIndex, true, false);
                    currentSortColIndex  = colIndex;
                    currentSortAscending = true;
                    currentSortType.fn(colIndex, true);
                };

        downArrowImage = document.createElement('IMG');
        downArrowImage.src = (isDescending ? DATA_URL_DOWN : DATA_URL_DOWN_FADED);
        setImageStyle(downArrowImage);
        downArrowImage.onclick = function(){
                    updateLinkCell(colIndex, false, true);
                    currentSortColIndex  = colIndex;
                    currentSortAscending = false;
                    currentSortType.fn(colIndex, false);
                };

        linkCell.appendChild(upArrowImage);
        linkCell.appendChild(downArrowImage);
    }


    function redraw(){
        forEach(rowObjects, function(item){
            item.removeFromParent();
        });

        forEach(rowObjects, function(item){
            item.attachToParent();
        });
    }

}
