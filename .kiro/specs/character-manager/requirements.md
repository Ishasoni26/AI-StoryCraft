# Requirements Document

## Introduction

The Character Manager feature adds a dedicated "Characters" tab to the AI StoryCraft studio page, enabling users to define multiple named characters with visual descriptions. When the AI generates scenes, the system automatically detects which characters appear in each scene's dialogue text and injects the corresponding visual descriptions into the image prompt. This replaces the current single `characterProfile` text field approach with a robust multi-character system.

## Glossary

- **Character_Manager**: The UI component (tab panel) where users create, edit, and delete character definitions
- **Character_Entry**: A single character record consisting of a name and a visual description
- **Character_List**: The persisted collection of all Character_Entry records for the current session
- **Scene_Dialogue**: The text content of a single scene returned by the generate API
- **Image_Prompt**: The English description used to generate an AI image for a specific scene
- **Prompt_Injector**: The server-side logic that detects character names in Scene_Dialogue and appends matching visual descriptions to the Image_Prompt
- **Studio_Page**: The main application page at `/studio` containing the script editor, settings, and storyboard viewer
- **Generate_API**: The server endpoint at `/api/generate` that receives a script and returns scenes with image prompts

## Requirements

### Requirement 1: Character Tab Display

**User Story:** As a content creator, I want a dedicated Characters tab in the studio page, so that I can manage my story characters separately from script and settings.

#### Acceptance Criteria

1. THE Studio_Page SHALL display a "Characters" tab button alongside the existing "Script & Idea" and "Settings & Audio" tab buttons
2. WHEN the user clicks the "Characters" tab button, THE Studio_Page SHALL display the Character_Manager panel and hide other tab content
3. THE Character_Manager SHALL display an "Add Character" button and the current Character_List

### Requirement 2: Add Character

**User Story:** As a content creator, I want to add new characters with a name and visual description, so that the AI can use consistent character appearances across scenes.

#### Acceptance Criteria

1. WHEN the user clicks the "Add Character" button, THE Character_Manager SHALL display input fields for character name and visual description
2. WHEN the user provides a non-empty character name and visual description and confirms, THE Character_Manager SHALL add the new Character_Entry to the Character_List
3. THE Character_Manager SHALL display the newly added Character_Entry in the Character_List immediately after creation
4. IF the user attempts to add a character with an empty name, THEN THE Character_Manager SHALL prevent submission and display a validation message

### Requirement 3: Edit Character

**User Story:** As a content creator, I want to edit existing character definitions, so that I can refine character descriptions as my story evolves.

#### Acceptance Criteria

1. WHEN the user activates the edit action on a Character_Entry, THE Character_Manager SHALL display the name and visual description in editable fields
2. WHEN the user modifies the character name or visual description and confirms, THE Character_Manager SHALL update the Character_Entry in the Character_List
3. IF the user edits a character name to an empty value, THEN THE Character_Manager SHALL prevent the update and display a validation message

### Requirement 4: Delete Character

**User Story:** As a content creator, I want to delete characters I no longer need, so that my character list stays clean and relevant.

#### Acceptance Criteria

1. WHEN the user activates the delete action on a Character_Entry, THE Character_Manager SHALL remove the Character_Entry from the Character_List
2. WHEN a Character_Entry is deleted, THE Character_Manager SHALL update the displayed list immediately

### Requirement 5: Persist Characters

**User Story:** As a content creator, I want my character definitions to be saved automatically, so that I do not lose my work when I close the browser.

#### Acceptance Criteria

1. WHEN the Character_List changes (add, edit, or delete), THE Character_Manager SHALL persist the updated Character_List to localStorage
2. WHEN the Studio_Page loads, THE Character_Manager SHALL restore the Character_List from localStorage
3. IF no saved Character_List exists in localStorage, THEN THE Character_Manager SHALL display an empty Character_List

### Requirement 6: Automatic Character Detection in Scenes

**User Story:** As a content creator, I want the system to automatically detect which characters appear in each scene, so that correct character visuals are included without manual effort.

#### Acceptance Criteria

1. WHEN the Generate_API processes a scene, THE Prompt_Injector SHALL check the Scene_Dialogue text for occurrences of each character name in the Character_List
2. WHEN a character name is found in the Scene_Dialogue, THE Prompt_Injector SHALL identify that Character_Entry as present in the scene
3. THE Prompt_Injector SHALL perform case-insensitive matching when comparing character names against Scene_Dialogue text

### Requirement 7: Inject Character Descriptions into Image Prompts

**User Story:** As a content creator, I want matching character descriptions automatically added to each scene's image prompt, so that generated images show the correct characters.

#### Acceptance Criteria

1. WHEN one or more characters are detected in a scene, THE Prompt_Injector SHALL include the visual description of each matched character in the Image_Prompt for that scene
2. WHEN multiple characters are detected in a single scene, THE Prompt_Injector SHALL include all matched character descriptions in the Image_Prompt
3. WHEN no characters from the Character_List are detected in a scene, THE Prompt_Injector SHALL generate the Image_Prompt without injecting character descriptions
4. THE Prompt_Injector SHALL replace the existing single characterProfile injection logic with the multi-character injection approach

### Requirement 8: Pass Character List to Generate API

**User Story:** As a content creator, I want the character list sent to the generate endpoint, so that the AI has character context when creating scene prompts.

#### Acceptance Criteria

1. WHEN the user triggers storyboard generation, THE Studio_Page SHALL send the full Character_List (names and visual descriptions) to the Generate_API
2. THE Generate_API SHALL accept the Character_List as part of the request payload alongside the script and other parameters
3. IF the Character_List is empty or not provided, THEN THE Generate_API SHALL fall back to the existing single characterProfile behavior for backward compatibility
