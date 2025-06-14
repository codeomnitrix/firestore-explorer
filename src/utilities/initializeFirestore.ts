import * as admin from "firebase-admin";
import * as vscode from "vscode";
import * as fs from "fs";
import openServiceAccountSettings from "../commands/openServiceAccountSettings";

/**
 * Attempts to initialize Firestore and prompts the user to check settings in case of failure.
 * @returns the initialized Firestore instance
 */
export default async function initializeFirestore(force = false): Promise<admin.firestore.Firestore> {
  try {
    // If Firebase is not initialized yet, attempt to do it now
    if (force || admin.apps.length === 0 || admin.apps[0]?.firestore() === undefined) {
      // First obtain the service account key path
      const filePath = (await vscode.workspace
        .getConfiguration("firestore-studio")
        .get("serviceAccountKeyPath")) as string;

      // If no path is provided, throw an exception and advise to fill in the configuration
      if (filePath === "") {
        vscode.window
          .showWarningMessage(
            "You need to specify the path to your Firebase Service Account Key. [How to get my Service Account Key?](https://firebase.google.com/docs/admin/setup#initialize_the_sdk)",
            "Open configuration",
          )
          .then(async (string) => {
            if (string === "Open configuration") {
              await openServiceAccountSettings();
            }
          });

        throw new Error("Service account key path not specified");
      }

      // Initialize the Firebase app with the service account key
      const serviceAccount = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      }
      // Firebase is initialized.
    }
  } catch (e) {
    // Something went wrong. Firebase could not be initialized.
    vscode.window.showErrorMessage("Failed to initialize Firebase. Please check your settings." + (e instanceof Error ? ` Error: ${e.message}` : ""));
    console.error(e);
  }

  // TODO: handle errors in case of initialization failure
  return admin.app().firestore();
}
