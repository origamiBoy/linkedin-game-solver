// Game configuration object that defines all game types and their properties
const GAME_CONFIG = {
    mini_sudoku: {
        name: "Mini Sudoku",
        url: "https://www.linkedin.com/games/view/mini-sudoku/desktop/",
        urlPattern: "sudoku",
        icon: {
            normal: "../../icons/game/mini_sudoku.svg",
            solved: "../../icons/game/mini_sudoku_solved.svg"
        },
        backgroundColor: "#d6faee",
        tags: {
            perfect: true,
            ai: false
        },
        tagline: "The classic game, made mini",
        about: "A mini sudoku puzzle in a 2 by 3 grid. Algorithmically solved.",
        controls: [
            {
                name: "Solve",
                id: "solve-button",
                icon: "play_arrow",
                description: "Solves the puzzle. Unable to save scores.",
                solveAction: "solve",
                requirements: {
                    ai: false,
                    stored: false
                }
            }
        ]
    },
    queens: {
        name: "Queens",
        url: "https://www.linkedin.com/games/view/queens/desktop/",
        urlPattern: "queens", // Single pattern for URL detection
        icon: {
            normal: "../../icons/game/queens.svg",
            solved: "../../icons/game/queens_solved.svg"
        },
        backgroundColor: "#f5ebff",
        tags: {
            perfect: true,
            ai: false
        },
        tagline: "Crown each region",
        about: "A logic puzzle where no queens can attack each other. Algorithmically solved.",
        storageKey: "queensSolution",
        controls: [
            {
                name: "Solve",
                id: "solve-button",
                icon: "play_arrow",
                description: "Solves the puzzle and saves solution",
                solveAction: "solve",
                requirements: {
                    ai: false,
                    stored: false
                }
            },
            {
                name: "Input Stored",
                id: "input-stored-button",
                icon: "input",
                description: "Input a previously stored solution",
                solveAction: "inputStoredSolution",
                requirements: {
                    ai: false,
                    stored: true
                }
            }
        ]
    },
    zip: {
        name: "Zip",
        url: "https://www.linkedin.com/games/view/zip/desktop/",
        urlPattern: "zip", // Single pattern for URL detection
        icon: {
            normal: "../../icons/game/zip.svg",
            solved: "../../icons/game/zip_solved.svg"
        },
        backgroundColor: "#ffdccd",
        tags: {
            perfect: true,
            ai: false
        },
        tagline: "Complete the path",
        about: "Connect all the dots with a single line and use all grid cells. Algorithmically solved.",
        storageKey: "zipSolution",
        controls: [
            {
                name: "Solve",
                id: "solve-button",
                icon: "play_arrow",
                description: "Solves the puzzle and saves solution",
                solveAction: "solve",
                requirements: {
                    ai: false,
                    stored: false
                }
            },
            {
                name: "Input Stored",
                id: "input-stored-button",
                icon: "input",
                description: "Input a previously stored solution",
                solveAction: "inputStoredSolution",
                requirements: {
                    ai: false,
                    stored: true
                }
            }
        ]
    },
    tango: {
        name: "Tango",
        url: "https://www.linkedin.com/games/view/tango/desktop/",
        urlPattern: "tango", // Single pattern for URL detection
        icon: {
            normal: "../../icons/game/tango.svg",
            solved: "../../icons/game/tango_solved.svg"
        },
        backgroundColor: "#e9edf1",
        tags: {
            perfect: true,
            ai: false
        },
        tagline: "Harmonize the grid",
        about: "Fill the grid with moons and suns. Algorithmically solved.",
        storageKey: "tangoSolution",
        controls: [
            {
                name: "Solve",
                id: "solve-button",
                icon: "play_arrow",
                description: "Solves the puzzle and saves solution",
                solveAction: "solve",
                requirements: {
                    ai: false,
                    stored: false
                }
            },
            {
                name: "Input Stored",
                id: "input-stored-button",
                icon: "input",
                description: "Input a previously stored solution",
                solveAction: "inputStoredSolution",
                requirements: {
                    ai: false,
                    stored: true
                }
            }
        ]
    },
    pinpoint: {
        name: "Pinpoint",
        url: "https://www.linkedin.com/games/view/pinpoint/desktop/",
        urlPattern: "pinpoint", // Single pattern for URL detection
        icon: {
            normal: "../../icons/game/pinpoint.svg",
            solved: "../../icons/game/pinpoint_solved.svg"
        },
        backgroundColor: "#e0efff",
        tags: {
            perfect: true,
            ai: true
        },
        tagline: "Guess the category",
        about: "Word puzzle for guessing the category. AI solved (or found programatically if not by AI).",
        storageKey: "pinpointSolution",
        controls: [
            {
                name: "Solve",
                id: "solve-button",
                icon: "play_arrow",
                description: "Gets, solves, and saves solution",
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
                description: "Input a previously stored solution",
                solveAction: "inputStoredSolution",
                requirements: {
                    ai: false,
                    stored: true
                }
            },
            {
                name: "Direct Save",
                id: "direct-solve-button",
                icon: "bolt",
                description: "Programatically gets and saves solution",
                solveAction: "direct",
                requirements: {
                    ai: false,
                    stored: false
                }
            }
        ]
    },
    crossclimb: {
        name: "Crossclimb",
        url: "https://www.linkedin.com/games/view/crossclimb/desktop/",
        urlPattern: "crossclimb", // Single pattern for URL detection
        icon: {
            normal: "../../icons/game/crossclimb.svg",
            solved: "../../icons/game/crossclimb_solved.svg"
        },
        backgroundColor: "#def9fc",
        tags: {
            perfect: true,
            ai: true
        },
        tagline: "Unlock a trivia ladder",
        about: "Word puzzle for guessing the clues in a words ladder. AI solved (not guaranteed), found programatically, or through a saved solution.",
        storageKey: "crossclimbSolution",
        controls: [
            {
                name: "Solve",
                id: "solve-button",
                icon: "play_arrow",
                description: "Attempts to get, solve, and save solution",
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
                description: "Input a previously stored solution",
                solveAction: "inputStoredSolution",
                requirements: {
                    ai: false,
                    stored: true
                }
            },
            {
                name: "Direct Solve",
                id: "direct-solve-button",
                icon: "bolt",
                description: "Programatically solves and saves solution",
                solveAction: "direct",
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