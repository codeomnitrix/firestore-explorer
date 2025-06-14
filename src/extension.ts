// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import copyPath from "./commands/copyPath";
import init from "./commands/init";
import orderBy from "./commands/oderBy";
import openPath from "./commands/openPath";
import openServiceAccountSettings from "./commands/openServiceAccountSettings";
import { scheme } from "./constants";
import { DocumentFileSystemProvider } from "./editor/DocumentFileSystemProvider";
import ExplorerDataProvider from "./explorer/ExplorerDataProvider";
import { CollectionItem, Item } from "./explorer/items";
import initializeFirestore from "./utilities/initializeFirestore";
import { openCollectionAsTable } from "./webview/openCollectionAsTable";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  const explorerDataProvider = new ExplorerDataProvider();

  const explorerView = vscode.window.createTreeView('firestore-explorer-view', {
    treeDataProvider: explorerDataProvider,
  });

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "firestore-explorer.setServiceAccountKeyPath",
      openServiceAccountSettings
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "firestore-explorer.init",
      init
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "firestore-explorer.openPath",
      openPath
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "firestore-explorer.refreshExplorer",
      () => explorerDataProvider.refresh()
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "firestore-explorer.copyPath",
      copyPath
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "firestore-explorer.orderBy",
      (item: Item) => orderBy(item, explorerDataProvider)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "firestore-explorer.showMoreItems",
      (path: string) => {
        console.log("Show more items for path:", path);
        explorerDataProvider.showMoreItems(path);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "firestore-explorer.openCollectionAsTable",
      (item: CollectionItem) => {
        openCollectionAsTable(item);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("firestore-explorer.createDocument", async (item) => {
      // Prompt for document ID (optional)
      const docId = await vscode.window.showInputBox({
        prompt: "Enter Document ID (leave blank for auto-ID)",
        placeHolder: "Document ID"
      });

      // Prompt for JSON data
      const json = await vscode.window.showInputBox({
        prompt: "Enter document data as JSON",
        placeHolder: '{"field1": "value1", "field2": 123}'
      });

      if (!json) {
        vscode.window.showWarningMessage("No data entered.");
        return;
      }

      let data: any;
      try {
        data = JSON.parse(json);
      } catch (e) {
        vscode.window.showErrorMessage("Invalid JSON.");
        return;
      }

      try {
        const firestore = await initializeFirestore();
        const ref = docId
          ? item.reference.doc(docId)
          : item.reference.doc();
        await ref.set(data);
        vscode.window.showInformationMessage("Document created!");
        vscode.commands.executeCommand("firestore-explorer.refreshExplorer");
      } catch (err: any) {
        vscode.window.showErrorMessage("Failed to create document: " + err.message);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("firestore-explorer.deleteDocument", async (item) => {
      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to delete the document "${item.label}"?`,
        { modal: true },
        "Delete",
        "Cancel"
      );

      if (confirm === "Delete") {
        try {
          const firestore = await initializeFirestore();
          await item.reference.delete();
          vscode.window.showInformationMessage("Document deleted!");
          vscode.commands.executeCommand("firestore-explorer.refreshExplorer");
        } catch (err: any) {
          vscode.window.showErrorMessage("Failed to delete document: " + err.message);
        }
      }
    })
  );

  context.subscriptions.push(explorerView);

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(
      () => {
        initializeFirestore(true);
        explorerDataProvider.refresh();
      }
    )
  );

  context.subscriptions.push(vscode.workspace.registerFileSystemProvider(scheme, new DocumentFileSystemProvider(), { isCaseSensitive: true }));
}

// this method is called when your extension is deactivated
export function deactivate() { }
