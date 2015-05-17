angular.module('classeur.opt.fileDragging', [])
	.directive('clFileDraggingSrc', function($window, clFileDraggingSvc, clExplorerLayoutSvc) {
		var Hammer = $window.Hammer;
		var bodyElt = angular.element($window.document.body);
		return {
			restrict: 'A',
			link: function(scope, element) {
				function movePanel(evt) {
					evt.preventDefault();
					clFileDraggingSvc.panel.move().to(evt.center.x + 10, evt.center.y).end();
				}
				var hammertime = new Hammer(element[0]);
				hammertime.get('pan').set({
					direction: Hammer.DIRECTION_ALL,
					threshold: 0
				});
				hammertime.on('panstart', function(evt) {
					clFileDraggingSvc.setTargetFolder();
					clFileDraggingSvc.setFileSrc(scope.fileDao);
					clFileDraggingSvc.panel.width(clExplorerLayoutSvc.explorerWidth - clExplorerLayoutSvc.scrollbarWidth - (clExplorerLayoutSvc.noPadding ? 90 : 215));
					movePanel(evt);
					bodyElt.addClass('file dragging');
					scope.$apply();
				});
				hammertime.on('panmove', function(evt) {
					movePanel(evt);
				});
				hammertime.on('panend', function() {
					clFileDraggingSvc.moveFiles();
					clFileDraggingSvc.files = [];
					clFileDraggingSvc.setTargetFolder();
					bodyElt.removeClass('file dragging');
					scope.$apply();
				});
			}
		};
	})
	.directive('clFileDraggingTarget', function(clFileDraggingSvc, clExplorerLayoutSvc) {
		return {
			restrict: 'A',
			link: function(scope, element) {
				if (scope.folderDao === clExplorerLayoutSvc.createFolder) {
					return;
				}
				element.on('mouseenter', function() {
					if (clFileDraggingSvc.files.length) {
						clFileDraggingSvc.setTargetFolder(scope.folderDao);
						scope.$apply();
					}
				});
				element.on('mouseleave', function() {
					if (clFileDraggingSvc.targetFolder === scope.folderDao) {
						clFileDraggingSvc.setTargetFolder();
						scope.$apply();
					}
				});
			}
		};
	})
	.directive('clFileDragging', function(clFileDraggingSvc, clPanel) {
		return {
			restrict: 'E',
			templateUrl: 'opt/fileDragging/fileDragging.html',
			link: function(scope, element) {
				scope.fileDraggingSvc = clFileDraggingSvc;
				clFileDraggingSvc.panel = clPanel(element, '.panel');
			}
		};
	})
	.factory('clFileDraggingSvc', function($mdDialog, clExplorerLayoutSvc, clToast) {
		function setFileSrc(fileDao) {
			clFileDraggingSvc.files = fileDao.isSelected ? clExplorerLayoutSvc.files.filter(function(fileDao) {
				return !fileDao.isPublic && fileDao.isSelected;
			}) : [fileDao];
		}

		function setTargetFolder(folderDao) {
			if (clFileDraggingSvc.targetFolder) {
				clFileDraggingSvc.targetFolder.isDraggingTarget = false;
				clFileDraggingSvc.targetFolder = undefined;
			}
			if (folderDao) {
				folderDao.isDraggingTarget = true;
				clFileDraggingSvc.targetFolder = folderDao;
			}
		}

		function doMoveFiles(targetFolder, files) {
			var targetFolderId = targetFolder === clExplorerLayoutSvc.unclassifiedFolder ? '' : targetFolder.id;
			files = files.filter(function(fileDao) {
				if (fileDao.folderId !== targetFolderId) {
					fileDao.oldFolderId = fileDao.folderId;
					fileDao.folderId = targetFolderId;
					return true;
				}
			});
			if (files.length) {
				clExplorerLayoutSvc.refreshFiles();
				var msg = files.length;
				msg += msg > 1 ? ' files moved to ' : ' file moved to ';
				msg += targetFolder.name + '.';
				clToast(msg, 'Undo', function() {
					files.forEach(function(fileDao) {
						fileDao.folderId = fileDao.oldFolderId;
						fileDao.isPublic = targetFolder.isPublic;
					});
					clExplorerLayoutSvc.refreshFiles();
				});
			}
		}

		function moveFiles() {
			if (clFileDraggingSvc.targetFolder && clFileDraggingSvc.targetFolder !== clExplorerLayoutSvc.currentFolderDao) {
				if (clFileDraggingSvc.targetFolder.isPublic) {
					if (clFileDraggingSvc.targetFolder.sharing === 'rw') {
						var title = 'Change ownership';
						var confirm = $mdDialog.confirm()
							.title(title)
							.ariaLabel(title)
							.content('You\'re about to change the ownership of your file(s). Are you sure?')
							.ok('Yes')
							.cancel('No');
						return $mdDialog.show(confirm).then(doMoveFiles.bind(null, clFileDraggingSvc.targetFolder, clFileDraggingSvc.files));
					} else {
						return clToast('Cannot move files to read only folder.');
					}
				}
				doMoveFiles(clFileDraggingSvc.targetFolder, clFileDraggingSvc.files);
			}
		}

		var clFileDraggingSvc = {
			files: [],
			setFileSrc: setFileSrc,
			setTargetFolder: setTargetFolder,
			moveFiles: moveFiles
		};
		return clFileDraggingSvc;
	});
