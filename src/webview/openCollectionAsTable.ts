import * as vscode from "vscode";
import { CollectionItem } from "../explorer/items";
import initializeFirestore from "../utilities/initializeFirestore";
import openPath from "../commands/openPath";

export async function openCollectionAsTable(item: CollectionItem) {
    let hasMore = true;
    const panel = vscode.window.createWebviewPanel(
        "firestoreCollectionTable",
        `Collection: ${item.collectionId}`,
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
        }
    );

    const limit = vscode.workspace.getConfiguration().get("firestore-explorer.pagingLimit") as number;
    let loadedDocs: any[] = [];
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let headers: string[] = [];
    let isSearchMode = false;
    let searchValue = "";

    async function loadMoreDocs() {
        const firestore = await initializeFirestore();
        let query = item.reference.limit(limit);
        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }
        const snapshot = await query.get();
        const docs = snapshot.docs.map(doc => ({ ...doc.data(), __path: doc.ref.path }));
        if (docs.length > 0 && headers.length === 0) {
            headers = Object.keys(docs[0]);
        }
        loadedDocs = loadedDocs.concat(docs);
        if (snapshot.docs.length > 0) {
            lastDoc = snapshot.docs[snapshot.docs.length - 1];
        }
        hasMore = docs.length === limit;
        return docs.length;
    }

    async function searchDocs(value: string) {
        // Fetch all docs from the server (be careful with large collections!)
        loadedDocs = [];
        lastDoc = null;
        let hasMoreDocs = true;
        let allDocs: any[] = [];
        while (hasMoreDocs) {
            const firestore = await initializeFirestore();
            let query = item.reference.limit(limit);
            if (lastDoc) {
                query = query.startAfter(lastDoc);
            }
            const snapshot = await query.get();
            const docs = snapshot.docs.map(doc => ({ ...doc.data(), __path: doc.ref.path }));
            if (docs.length > 0 && headers.length === 0) {
                headers = Object.keys(docs[0]);
            }
            allDocs = allDocs.concat(docs);
            if (snapshot.docs.length > 0) {
                lastDoc = snapshot.docs[snapshot.docs.length - 1];
            }
            hasMoreDocs = docs.length === limit;
        }
        // Filter docs by search string in any field
        loadedDocs = allDocs.filter(doc =>
            Object.values(doc).some(val =>
                typeof val === "string"
                    ? val.toLowerCase().includes(value)
                    : typeof val === "object"
                        ? JSON.stringify(val).toLowerCase().includes(value)
                        : false
            )
        );
        hasMore = false; // No "Load More" in search results
    }

    async function getHtml() {
        return `
      <html>
      <head>
        <style>
          body {
            font-family: "Segoe UI", Arial, sans-serif;
            background: var(--vscode-editor-background, #f6f8fa);
            margin: 0;
            padding: 24px;
            color: var(--vscode-editor-foreground, #24292f);
          }
          h1 {
            font-size: 1.5em;
            margin-bottom: 0.2em;
          }
          .toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            gap: 16px;
          }
          .toolbar-actions {
            display: flex;
            gap: 8px;
            align-items: center;
          }
          .info {
            margin-bottom: 12px;
            color: var(--vscode-descriptionForeground, #586069);
          }
          input[type="text"] {
            padding: 6px 10px;
            border-radius: 4px;
            border: 1px solid var(--vscode-editorWidget-border, #ccc);
            font-size: 1em;
            background: var(--vscode-input-background, #fff);
            color: var(--vscode-input-foreground, #24292f);
            outline: none;
            min-width: 180px;
          }
          button {
            background: var(--vscode-button-background, #2d7ff9);
            color: var(--vscode-button-foreground, white);
            border: none;
            border-radius: 4px;
            padding: 6px 16px;
            font-size: 1em;
            cursor: pointer;
            transition: background 0.2s;
          }
          button:hover {
            background: var(--vscode-button-hoverBackground, #155ab6);
          }
          table {
            width: 100%;
            border-collapse: collapse;
            background: var(--vscode-editorWidget-background, white);
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
            border-radius: 6px;
            overflow: hidden;
          }
          th, td {
            padding: 8px 12px;
            text-align: left;
            border-bottom: 1px solid var(--vscode-editorWidget-border, #e1e4e8);
            font-size: 0.97em;
          }
          th {
            background: var(--vscode-editorWidget-border, #f3f4f6);
            font-weight: 600;
            color: var(--vscode-editor-foreground, #24292f);
          }
          tr:last-child td {
            border-bottom: none;
          }
          tr:hover {
            background: var(--vscode-list-hoverBackground, #f6f8fa);
          }
          tbody tr:nth-child(odd) {
            background: var(--vscode-editorWidget-background, #fff);
          }
          tbody tr:nth-child(even) {
            background: var(--vscode-editorWidget-border, #f3f4f6);
          }
          .actions {
            margin-top: 18px;
            text-align: right;
          }
        </style>
      </head>
      <body>
        <div class="toolbar">
          <h1>Collection: ${item.collectionId}</h1>
          <div class="toolbar-actions">
            <input id="searchInput" type="text" placeholder="Search..." value="${searchValue ? searchValue.replace(/"/g, '&quot;') : ''}" />
            <button id="searchBtn">Search</button>
            <button id="clearSearchBtn" ${isSearchMode ? "" : "style='display:none;'"}>Clear</button>
            <button id="exportBtn">Export as JSON</button>
          </div>
        </div>
        <div class="info">
          Showing <b>${loadedDocs.length}</b> documents. Click on a row to open the document.
        </div>
        <table>
          <thead>
            <tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr>
          </thead>
          <tbody id="table-body">
            ${loadedDocs.map(doc => `
              <tr data-path="${doc.__path || doc.id}">
                ${headers.map(h => {
                  const value = doc[h];
                  return `<td>${value !== null && typeof value === "object"
                    ? JSON.stringify(value)
                    : value ?? ""
                  }</td>`;
                }).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
        <div class="actions">
          ${!isSearchMode && hasMore ? `<button id="loadMoreBtn">Load More</button>` : ""}
        </div>
        <script>
          window.addEventListener('DOMContentLoaded', function() {
            const vscode = acquireVsCodeApi();

            // Export
            const exportBtn = document.getElementById('exportBtn');
            if (exportBtn) {
              exportBtn.onclick = function() {
                const rows = Array.from(document.querySelectorAll('#table-body tr'));
                const headers = Array.from(document.querySelectorAll('thead th')).map(th => th.textContent);
                const data = rows.map(row => {
                  const cells = Array.from(row.children);
                  const obj = {};
                  headers.forEach((h, i) => {
                    try {
                      obj[h] = JSON.parse(cells[i].textContent);
                    } catch {
                      obj[h] = cells[i].textContent;
                    }
                  });
                  return obj;
                });
                vscode.postMessage({
                  command: 'exportJson',
                  data: data
                });
              };
            }

            // Search
            const searchBtn = document.getElementById('searchBtn');
            if (searchBtn) {
              searchBtn.onclick = function() {
                const value = document.getElementById('searchInput').value.trim();
                vscode.postMessage({ command: 'search', value });
              };
            }

            // Clear Search
            const clearBtn = document.getElementById('clearSearchBtn');
            if (clearBtn) {
              clearBtn.onclick = function() {
                vscode.postMessage({ command: 'clearSearch' });
              };
            }

            // Load More
            const loadMoreBtn = document.getElementById('loadMoreBtn');
            if (loadMoreBtn) {
              loadMoreBtn.onclick = function() {
                vscode.postMessage({ command: 'loadMore' });
              };
            }

            // Row click
            document.getElementById('table-body').addEventListener('click', function(event) {
              const target = event.target.closest('tr');
              if (target) {
                const path = target.getAttribute('data-path');
                vscode.postMessage({ command: 'openDoc', path: path });
              }
            });

            // Enter key triggers search
            document.getElementById('searchInput').addEventListener('keydown', function(event) {
              if (event.key === 'Enter') {
                searchBtn.click();
              }
            });
          });
        </script>
      </body>
      </html>
    `;
    }

    // Initial load
    await loadMoreDocs();
    panel.webview.html = await getHtml();

    panel.webview.onDidReceiveMessage(async message => {
        if (message.command === "loadMore") {
            const added = await loadMoreDocs();
            panel.webview.html = await getHtml();
        }
        if (message.command === "openDoc" && message.path) {
            openPath(message.path);
        }
        if (message.command === "exportJson") {
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file('firestore_export.json'),
                filters: { 'JSON': ['json'] }
            });
            if (uri) {
                await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(message.data, null, 2)));
                vscode.window.showInformationMessage('Exported JSON!');
            } else {
                vscode.window.showWarningMessage('Export failed.');
            }
        }
        if (message.command === "search") {
            searchValue = message.value.trim().toLowerCase();
            if (!searchValue) {
                // If search is empty, reload initial docs
                isSearchMode = false;
                loadedDocs = [];
                lastDoc = null;
                await loadMoreDocs();
                panel.webview.html = await getHtml();
                return;
            }
            isSearchMode = true;
            await searchDocs(searchValue);
            panel.webview.html = await getHtml();
        }
        if (message.command === "clearSearch") {
            isSearchMode = false;
            searchValue = "";
            loadedDocs = [];
            lastDoc = null;
            await loadMoreDocs();
            panel.webview.html = await getHtml();
        }
    });
}