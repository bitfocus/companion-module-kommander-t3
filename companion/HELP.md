## Kommander Media Server

This module controls a Kommander media server (Kommander T0/T1/T3, F1/F1Pro/F2/F9 and PS-Series) over its WebSocket API.

### Configuration

- **Kommander URL**: `ws://<ip>:1702`, with the IP address of the Kommander computer (`ws://127.0.0.1:1702` when Companion runs on the same computer).
- **Reconnect**: reconnect 5 seconds after the connection drops.

Kommander must accept the connection: in **System Settings > Connection Settings**, enable "Allow access for cloud control, cloud control center, cloud platform, etc." and set a maximum number of connections that leaves room for Companion. When Kommander refuses the login (for example "Maximum connection number"), the connection status shows the reason.

### Actions

- **CallPlan**: call plan 1–32 of the current group, or the previous/next plan.
- **CallByName**: call a plan by its group and name. The list is loaded from Kommander when the module connects.
- **ChangePlanGroup**: select group 1–32, or the previous/next group.
- **ChangePlayStatus**: play, pause or stop.
- **CallTimeline**: toggle, play, pause or stop timeline 1–32.
- **SoundControl**: mute/unmute, volume up or volume down.
- **SetVolumeValue**: set the volume (0–100).
- **Screen On/Off**: turn the black screen on or off.
- **Bright&Contrast**: brightness or contrast up/down.
- **SetBrightValue** / **SetContrastValue**: set the brightness or the contrast (-100 to 100).
- **Output On/Off**: turn all outputs on or off.
- **PageTurn**: previous/next page of a presentation.
- **Master Switch**: Kommander's master switch (role change).
- **Lock**: lock or unlock Kommander.

### Feedbacks

- **CallPlan**: the plan with this number is on air.
- **CallByName**: the plan with this group and name is on air.
- **PreGroup**: the group with this number is the current group.
- **PlayStatus**: Kommander is playing, paused or stopped (plan projects only).
- **Unmute**: the audio is muted.
- **BlackScreen**: the black screen is on.
- **MonitorStatus**: the outputs are on.
- **Lock**: Kommander is locked.

### Variables

Use them as `$(<connection label>:<variable>)`, for example `$(kommander:plan_name)`.

| Variable       | Value                              |
| -------------- | ---------------------------------- |
| `plan_number`  | Number of the plan on air          |
| `plan_name`    | Name of the plan on air            |
| `group_number` | Number of the current plan group   |
| `group_name`   | Name of the current plan group     |
| `play_status`  | `Play`, `Pause` or `Stop`          |
| `mute`         | `true` when the audio is muted     |
| `blackscreen`  | `true` when the black screen is on |
| `output`       | `true` when the outputs are on     |
| `lock`         | `true` when Kommander is locked    |
| `project_type` | `Plan` or `Timeline`               |

### Presets

- **Plans** and **Groups**: plans and groups 1–32. A plan turns red while it is on air, and a group turns blue while it is the current group.
- **Plans: _group name_** and **Groups by name**: one button for each plan and group of the open project, named after them. They appear once the module has connected to Kommander.
- **Navigation**, **Playback**, **Screen**, **Audio**, **System** and **Presentation**: one button for each action, with its feedback where there is one.
- **Status**: the plan on air, the current group and the play status.
