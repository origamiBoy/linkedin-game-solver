// Game configuration object for service worker
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
        about: "A puzzle game where you place queens on a chess board without them attacking each other.",
        controls: [
            {
                name: "Solve",
                id: "solve-button",
                icon: "play_arrow",
                description: "Solves the puzzle, first tried guaranteed",
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
        about: "A puzzle game where you connect dots to form shapes.",
        controls: [
            {
                name: "Solve",
                id: "solve-button",
                icon: "play_arrow",
                description: "Solves the puzzle, first tried guaranteed",
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
        about: "A word puzzle where you find words that match the given clues.",
        controls: [
            {
                name: "Solve",
                id: "solve-button",
                icon: "play_arrow",
                description: "Solves the puzzle, first tried guaranteed",
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
        about: "A word search puzzle where you find words in a grid of letters.",
        storageKey: "pinpointSolution",
        controls: [
            {
                name: "Solve",
                id: "solve-button",
                icon: "play_arrow",
                description: "Solve the current puzzle",
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
                description: "Gets, solves, and saves the solution",
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
        about: "A word chain puzzle where you connect words by changing one letter at a time. The AI solver uses OpenAI to find solutions.",
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
            }
        ]
    }
};

// Make the config available globally for service worker
self.GAME_CONFIG = GAME_CONFIG; 