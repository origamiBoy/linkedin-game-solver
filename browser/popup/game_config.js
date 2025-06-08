// Game configuration object that defines all game types and their properties
const GAME_CONFIG = {
    queens: {
        name: "Queens",
        url: "https://www.linkedin.com/games/view/queens/desktop/",
        icon: {
            normal: "../../icons/game/queens.svg",
            solved: "../../icons/game/queens_solved.svg"
        },
        backgroundColor: "#f5ebff",
        tags: {
            perfect: true,
            ai: false
        },
        about: "Crown each region.",
        controls: [
            {
                name: "Solve",
                id: "solve-button",
                icon: "play_arrow",
                description: "Solves the puzzle. Simple as that.",
                solveAction: "solve",
                requirements: {
                    ai: false,
                    stored: false
                }
            }
        ]
    },
    zip: {
        name: "Zip",
        url: "https://www.linkedin.com/games/view/zip/desktop/",
        icon: {
            normal: "../../icons/game/zip.svg",
            solved: "../../icons/game/zip_solved.svg"
        },
        backgroundColor: "#ffdccd",
        tags: {
            perfect: true,
            ai: false
        },
        about: "Complete the path.",
        controls: [
            {
                name: "Solve",
                id: "solve-button",
                icon: "play_arrow",
                description: "Solves the puzzle. Simple as that.",
                solveAction: "solve",
                requirements: {
                    ai: false,
                    stored: false
                }
            }
        ]
    },
    tango: {
        name: "Tango",
        url: "https://www.linkedin.com/games/view/tango/desktop/",
        icon: {
            normal: "../../icons/game/tango.svg",
            solved: "../../icons/game/tango_solved.svg"
        },
        backgroundColor: "#e9edf1",
        tags: {
            perfect: true,
            ai: false
        },
        about: "Harmonize the grid.",
        controls: [
            {
                name: "Solve",
                id: "solve-button",
                icon: "play_arrow",
                description: "Solves the puzzle. Simple as that.",
                solveAction: "solve",
                requirements: {
                    ai: false,
                    stored: false
                }
            }
        ]
    },
    pinpoint: {
        name: "Pinpoint",
        url: "https://www.linkedin.com/games/view/pinpoint/desktop/",
        icon: {
            normal: "../../icons/game/pinpoint.svg",
            solved: "../../icons/game/pinpoint_solved.svg"
        },
        backgroundColor: "#e0efff",
        tags: {
            perfect: true,
            ai: true
        },
        about: "Guess the category.",
        storageKey: "pinpointSolution",
        controls: [
            {
                name: "Solve",
                id: "solve-button",
                icon: "play_arrow",
                description: "Gets, solves, and saves the solution",
                solveAction: "solve",
                requirements: {
                    ai: true,
                    stored: false
                }
            },
            {
                name: "Input Stored",
                id: "input-stored-button",
                icon: "input",
                description: "Input a previously solved solution",
                solveAction: "inputStoredSolution",
                requirements: {
                    ai: false,
                    stored: true
                }
            }
        ]
    },
    crossclimb: {
        name: "Crossclimb",
        url: "https://www.linkedin.com/games/view/crossclimb/desktop/",
        icon: {
            normal: "../../icons/game/crossclimb.svg",
            solved: "../../icons/game/crossclimb_solved.svg"
        },
        backgroundColor: "#def9fc",
        tags: {
            perfect: false,
            ai: true
        },
        about: "Unlock a trivia ladder.",
        storageKey: "crossclimbSolution",
        controls: [
            {
                name: "Solve",
                id: "solve-button",
                icon: "play_arrow",
                description: "Gets, solves, and saves the solution",
                solveAction: "solve",
                requirements: {
                    ai: true,
                    stored: false
                }
            },
            {
                name: "Input Stored",
                id: "input-stored-button",
                icon: "input",
                description: "Input a previously solved solution",
                solveAction: "inputStoredSolution",
                requirements: {
                    ai: false,
                    stored: true
                }
            },
            {
                name: "Cheat",
                id: "cheat-button",
                icon: "psychology",
                description: "Cheats and stores solutions",
                solveAction: "cheat",
                requirements: {
                    ai: false,
                    stored: false
                }
            }
        ]
    }
};

// Export for regular scripts
export default GAME_CONFIG; 