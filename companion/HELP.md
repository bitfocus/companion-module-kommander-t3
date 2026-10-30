## Kommander Media Server

This module controls a Kommander media server (Kommander T0/T1/T3, F1/F1Pro/F2/F9 and PS-Series) over its WebSocket API.

### Configuration

- **Kommander URL**: `ws://<ip>:1702`, with the IP address of the Kommander computer (`ws://127.0.0.1:1702` when Companion runs on the same computer).
- **Username** and **Password**: a user of Kommander (**System Settings > Users**). The default, `streamDeck`, works without any setup.
- **Reconnect**: reconnect 5 seconds after the connection drops.
- **Log messages**: log every message to and from Kommander, for troubleshooting.

In Kommander, **System Settings > Connection** must have **Enable Cloud Control/Third-Party Platform Access** checked. The number next to it is how many clients can connect at the same time: leave room for Companion and anything else that connects (2 or more). When Kommander refuses the login, for example with "Maximum connection number", the connection status shows the reason.

### Preview (PVW) mode

Plan projects have a preview mode: while it is on, the plans you call go to the preview and **Take** puts the preview on air. The plan buttons of the presets show the plan in preview in green and the plan on air in red. Turn preview mode on and off from Companion (**Preview mode**) or from Kommander.

### Actions

- **CallPlan**: call plan 1–32 of the current group, or the previous/next plan.
- **CallByName**: call a plan by its group and name.
- **ChangePlanGroup**: select group 1–32, or the previous/next group. Plan numbers call the plans of this group.
- **Preview mode (PVW)**: turn preview mode on, off or toggle it.
- **Take (preview to air)**: put the plan in preview on air.
- **Copy air to preview**: copy what is on air to the preview, to adjust it there.
- **ChangePlayStatus**: play, pause or stop.
- **CallTimeline**: toggle, play, pause or stop timeline 1–32 (timeline projects).
- **SoundControl**: mute/unmute, volume up or volume down.
- **SetVolumeValue**: set the volume (0–100).
- **File: mute** and **File: volume**: mute, unmute or set the volume of one file of the plan on air (or in preview), by its name, for example `video.mp4`.
- **Screen On/Off**: turn the black screen on or off.
- **Output On/Off**: turn all outputs on or off.
- **Bright&Contrast**: brightness or contrast up/down.
- **SetBrightValue** / **SetContrastValue**: set the brightness or the contrast (-100 to 100).
- **PageTurn**: previous/next page of the presentations on air.
- **Record output**: start, stop or toggle recording the output to an .mp4 file, which Kommander saves (by default on the Windows desktop).
- **Lock**: lock or unlock the Kommander window. The output keeps going.
- **Master Switch**: switch between the main and the backup Kommander (only with a backup set up in Kommander's Online settings).

### Feedbacks

- **CallPlan** / **CallByName**: the plan with this number or name is on air.
- **Plan in preview** / **Plan in preview (by name)**: in preview mode, the plan with this number or name is in the preview.
- **Preview mode**: Kommander is in preview mode.
- **PreGroup**: the group with this number is the current group.
- **PlayStatus**: Kommander is playing, paused or stopped (plan projects).
- **Muted**: the audio is muted.
- **BlackScreen**: the black screen is on.
- **MonitorStatus**: the outputs are on.
- **Lock**: Kommander is locked.
- **Recording**: the output is being recorded (started from Companion).

### Variables

Use them as `$(<connection label>:<variable>)`, for example `$(kommander:plan_name)`.

| Variable                                     | Value                                                       |
| -------------------------------------------- | ----------------------------------------------------------- |
| `plan_number`, `plan_name`                   | Plan on air                                                 |
| `group_number`, `group_name`                 | Current plan group                                          |
| `preview_mode`                               | `true` in preview mode                                      |
| `preview_plan_number`, `preview_plan_name`   | Plan in preview                                             |
| `preview_group_number`, `preview_group_name` | Group of the plan in preview                                |
| `play_status`                                | `Play`, `Pause` or `Stop`                                   |
| `video_name`                                 | Video playing (the one with the most time left, if several) |
| `video_elapsed`, `video_remaining`           | Elapsed time and time left of that video (mm:ss)            |
| `video_remaining_seconds`                    | Time left in seconds, for triggers and expressions          |
| `video_duration`                             | Duration of the video (mm:ss)                               |
| `volume`                                     | Volume (0–100). Kommander only tells it when it changes     |
| `mute`                                       | `true` when the audio is muted (known once it changes)      |
| `brightness`, `contrast`                     | Output brightness and contrast (-100 to 100)                |
| `blackscreen`                                | `true` when the black screen is on                          |
| `output`                                     | `true` when the outputs are on                              |
| `lock`                                       | `true` when Kommander is locked                             |
| `recording`, `record_time`                   | Recording started from Companion, and its time (mm:ss)      |
| `project_type`                               | `Plan` or `Timeline`                                        |

### Presets

- **Plans** and **Groups**: plans and groups 1–32. A plan is green while in preview and red while on air, and a group is blue while it is the current group.
- **Plans: _group name_** and **Groups by name**: one button for each plan and group of the open project, named after them. They follow the project: plans you add or rename in Kommander show up by themselves.
- **Preview (PVW)**: preview mode, Take, copy air to preview and the plan in preview.
- **Navigation**, **Playback**, **Screen**, **Audio**, **System** and **Presentation**: one button for each action, with its feedback where there is one.
- **Recording**: record on/off, with the recording time.
- **Timeline**: play/pause of timelines 1–32 (timeline projects).
- **Status**: the plan on air, the current group, the play status, the time left of the video and the volume.
