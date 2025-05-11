# UserAgent-Switcher

A highly configurable browser extension for spoofing your User-Agent string.

UserAgent-Switcher modifies both the User-Agent in your browser's request headers and relevant JavaScript `navigator` properties (e.g., `navigator.userAgent`, `navigator.appVersion`, `navigator.platform`). This allows for precise control over how your browser identifies itself to websites.

## Key Features

* **Comprehensive Spoofing:** Modifies both HTTP request headers and JavaScript `navigator` objects.
* **Granular Control:**
    * Spoof User-Agent per specific hostname.
    * Set different User-Agents for individual browser windows.
    * Utilize Firefox's container feature for distinct User-Agents per container.
* **Randomization:** Option to randomly select a User-Agent from a user-defined list.
* **Easy Import/Export:** Manage your User-Agent lists with simple import and export functionality.

## Demo / Review

See the extension in action:

[![User-Agent Switcher and Manager - Browser Extension Review](https://img.youtube.com/vi/-aVFxvF3N_E/0.jpg)](http://www.youtube.com/watch?v=-aVFxvF3N_E)

*(Video: "User-Agent Switcher and Manager - Browser Extension Review")*

## Installation - Official Releases

You can install the latest stable version from your browser's official add-on store:

* **Chrome:** [User-Agent Switcher and Manager](https://chrome.google.com/webstore/detail/user-agent-switcher-and-m/bhchdcejhohfmigjafbampogmaanbfkg)
* **Firefox:** [User-Agent String Switcher](https://addons.mozilla.org/firefox/addon/user-agent-string-switcher/)
* **Edge:** [UserAgent Switcher and Manager](https://microsoftedge.microsoft.com/addons/detail/useragent-switcher-and-m/cnjkedgepfdpdbnepgmajmmjdjkjnifa)
* **Opera:** [User-Agent Switcher](https://addons.opera.com/extensions/details/user-agent-switcher-8/)

## Usage

For detailed instructions on how to use the extension, including configuration options and features, please visit:
[UserAgent-Switcher Usage Guide](https://webextension.org/listing/useragent-switcher.html)

## Manual Installation for Firefox (from Source)

If you have cloned or downloaded the source files from this repository, you can manually install the extension in Firefox. This is useful for development, testing the latest (potentially unstable) code, or if you prefer to install extensions manually.

### Method 1: Load Temporary Add-on (for Development/Testing)

This method allows you to load the extension directly from the source files. It will remain installed until you restart Firefox or manually remove it.

1.  **Get the Source:** Ensure you have the extension's source files (including `manifest.json` at the root of the extension's directory structure) on your local machine. If you've cloned this repository, these files are typically in the main or a `src/` directory.
2.  **Open Firefox.**
3.  **Navigate to Debugging Tools:** Type `about:debugging` into the Firefox address bar and press Enter.
4.  **Select "This Firefox":** In the left-hand sidebar, click on "This Firefox".
5.  **Load Add-on:** Click the "Load Temporary Add-on..." button.
6.  **Select Manifest File:** Navigate to the directory where you have the extension's source code and select the `manifest.json` file. Click "Open."

The UserAgent-Switcher extension should now be loaded and active. If you make changes to the source code, you can click the "Reload" button next to the extension's entry on the `about:debugging` page to apply them.

### Method 2: Package as an .xpi File and Install

For a more persistent local installation from the source files, you can package the extension into an `.xpi` file.

1.  **Prepare Files:**
    * Ensure all necessary source files are present, with `manifest.json` at the root of what will become the packaged extension.
    * If this repository uses a build process (e.g., `npm run build`), run it first to generate the distributable files, typically in a `dist/`, `build/`, or `web-ext-artifacts/` folder. These instructions assume you are packaging the correct set of files for distribution.
2.  **Create a ZIP Archive:**
    * Navigate to the directory containing the finalized extension files (e.g., your `src/` folder or the build output directory).
    * Select all files and subfolders *inside* this directory. **Crucially, the `manifest.json` file must be at the root level within the ZIP archive, not nested inside another folder.**
    * Compress the selected items into a ZIP archive (e.g., `user_agent_switcher.zip`).
3.  **Rename to .xpi:**
    * Change the file extension of the ZIP archive from `.zip` to `.xpi` (e.g., rename `user_agent_switcher.zip` to `user_agent_switcher.xpi`). You might need to enable viewing file extensions in your operating system's file explorer settings.
4.  **Install in Firefox:**
    * Open Firefox.
    * Go to the Add-ons Manager (you can type `about:addons` in the address bar or press `Ctrl+Shift+A` on Windows/Linux or `Cmd+Shift+A` on Mac).
    * In the Add-ons Manager tab, select the "Extensions" panel.
    * Click on the gear icon (⚙️) in the upper-right area of the Extensions panel.
    * Select "Install Add-on From File..." from the dropdown menu.
    * Navigate to where you saved your `.xpi` file, select it, and click "Open."
    * Firefox will prompt you to confirm the installation and show the permissions the extension requires. Click "Add" if you trust the extension.

#### Important Considerations for .xpi Installation (from Source):

* **Extension Signing:** `.xpi` files created this way are unsigned. Standard versions of Firefox require extensions to be signed by Mozilla for security reasons.
    * To install unsigned extensions (primarily for development and testing), you can use Firefox Developer Edition or Firefox Nightly, where you can set the `xpinstall.signatures.required` preference to `false` in `about:config`. **This is not recommended for regular Browse as it lowers your security.**
    * Alternatively, you can submit the packaged `.xpi` to [addons.mozilla.org (AMO)](https://addons.mozilla.org/developers/) to get it signed by Mozilla (either for public listing or as an unlisted add-on).
* **Add-on ID:** For consistent behavior, especially if you intend to use the extension long-term, test features like storage, or update it, ensure the `manifest.json` in the source includes a unique add-on ID. If it's not already present, you can add it like this:
    ```json
    "browser_specific_settings": {
      "gecko": {
        "id": "user-agent-switcher@your-repository-or-domain.com"
      }
    }
    ```
    Replace the example ID with a unique identifier for your version.

---

## Contributing

Contributions are welcome! If you have ideas for improvements, new features, or have found a bug, please feel free to:

1.  Open an issue in the repository to discuss the change or report the bug.
2.  Fork the repository and submit a pull request with your changes.

Please ensure any contributions align with the project's coding style and goals.

## License

This project is licensed under the **Mozilla Public License 2.0 (MPL-2.0)**.

You can find a copy of the license in the `LICENSE` file in this repository or at [https://www.mozilla.org/en-US/MPL/2.0/](https://www.mozilla.org/en-US/MPL/2.0/).