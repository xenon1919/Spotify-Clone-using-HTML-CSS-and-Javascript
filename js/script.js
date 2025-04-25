let currentSong = new Audio();
let songs = [];
let currFolder;

function secondsToMinutesSeconds(seconds) {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  const formattedMinutes = String(minutes).padStart(2, "0");
  const formattedSeconds = String(remainingSeconds).padStart(2, "0");
  return `${formattedMinutes}:${formattedSeconds}`;
}

async function loadAllSongs() {
  try {
    const response = await fetch("/songs/");
    if (!response.ok) throw new Error("Failed to fetch /songs/");
    const text = await response.text();
    const div = document.createElement("div");
    div.innerHTML = text;
    const anchors = div.getElementsByTagName("a");
    const folders = Array.from(anchors).filter(
      (e) => e.href.includes("/songs/") && !e.href.includes(".htaccess")
    );

    for (const folderAnchor of folders) {
      const url = new URL(folderAnchor.href);
      const pathSegments = url.pathname.split("/").filter((segment) => segment);
      const folder = pathSegments[pathSegments.length - 1];
      if (!folder || folder === "songs") continue;

      const folderResponse = await fetch(`/songs/${folder}/`);
      if (!folderResponse.ok)
        throw new Error(`Failed to fetch /songs/${folder}/`);
      const folderText = await folderResponse.text();
      const folderDiv = document.createElement("div");
      folderDiv.innerHTML = folderText;
      const songAnchors = folderDiv.getElementsByTagName("a");

      for (const songAnchor of songAnchors) {
        if (songAnchor.href.endsWith(".mp3")) {
          const songName = songAnchor.href.split(`/songs/${folder}/`)[1];
          if (songName)
            songs.push({
              folder: `songs/${folder}`,
              name: decodeURI(songName),
            });
        }
      }
    }
  } catch (error) {
    console.error("Error loading all songs:", error);
  }
}

async function getSongs(folder) {
  if (!folder) {
    console.error("Folder parameter is undefined or empty");
    return [];
  }

  currFolder = folder;
  try {
    const response = await fetch(`/${folder}/`);
    if (!response.ok) throw new Error(`Failed to fetch /${folder}/`);
    const text = await response.text();
    const div = document.createElement("div");
    div.innerHTML = text;
    const as = div.getElementsByTagName("a");
    const localSongs = [];
    for (const element of as) {
      if (element.href.endsWith(".mp3")) {
        const songName = element.href.split(`/${folder}/`)[1];
        if (songName) localSongs.push(decodeURI(songName));
      }
    }

    const songUL = document
      .querySelector(".songList")
      .getElementsByTagName("ul")[0];
    songUL.innerHTML = "";
    for (const song of localSongs) {
      songUL.innerHTML += `
        <li>
          <img class="invert" width="34" src="img/music.svg" alt="">
          <div class="info">
            <div>${song.replaceAll("%20", " ")}</div>
            <div>Artist</div>
          </div>
          <div class="playnow">
            <span>Play Now</span>
            <img class="invert" src="img/play.svg" alt="">
          </div>
        </li>`;
    }

    Array.from(songUL.getElementsByTagName("li")).forEach((e) => {
      e.addEventListener("click", () => {
        playMusic(e.querySelector(".info").firstElementChild.innerHTML.trim());
      });
    });

    return localSongs;
  } catch (error) {
    console.error(`Error fetching songs for folder ${folder}:`, error);
    return [];
  }
}

async function playMusic(track, pause = false) {
  const songObj = songs.find((s) => decodeURI(s.name) === track);
  if (songObj) {
    currFolder = songObj.folder;
  } else {
    console.warn(`Track ${track} not found in library`);
    return;
  }

  currentSong.src = `/${currFolder}/` + encodeURI(track);
  if (!pause) {
    currentSong.play();
    play.src = "img/pause.svg";
  }
  document.querySelector(".songinfo").innerHTML = decodeURI(track);
  document.querySelector(".songtime").innerHTML = "00:00 / 00:00";
}

async function displayAlbums() {
  try {
    const response = await fetch("/songs/");
    if (!response.ok) throw new Error("Failed to fetch /songs/");
    const text = await response.text();
    const div = document.createElement("div");
    div.innerHTML = text;
    const anchors = div.getElementsByTagName("a");
    const cardContainer = document.querySelector(".cardContainer");

    for (const e of anchors) {
      if (e.href.includes("/songs/") && !e.href.includes(".htaccess")) {
        const url = new URL(e.href);
        const pathSegments = url.pathname
          .split("/")
          .filter((segment) => segment);
        const folder = pathSegments[pathSegments.length - 1];
        if (!folder || folder === "songs") continue;

        try {
          const a = await fetch(`/songs/${folder}/info.json`);
          if (!a.ok)
            throw new Error(`Failed to fetch /songs/${folder}/info.json`);
          const response = await a.json();

          cardContainer.innerHTML += `
            <div data-folder="${folder}" class="card">
              <div class="play">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 20V4L19 12L5 20Z" stroke="#141B34" fill="#000" stroke-width="1.5" stroke-linejoin="round" />
                </svg>
              </div>
              <img src="/songs/${folder}/cover.jpg" alt="">
              <h2>${response.title}</h2>
              <p>${response.description}</p>
            </div>`;
        } catch (error) {
          console.error(`Error fetching metadata for folder ${folder}:`, error);
        }
      }
    }

    Array.from(document.getElementsByClassName("card")).forEach((e) => {
      e.addEventListener("click", async (item) => {
        const localSongs = await getSongs(
          `songs/${item.currentTarget.dataset.folder}`
        );
        if (localSongs.length > 0) playMusic(localSongs[0]);
      });
    });
  } catch (error) {
    console.error("Error displaying albums:", error);
  }
}

async function main() {
  await loadAllSongs();
  if (songs.length > 0) {
    currFolder = songs[0].folder;
    playMusic(songs[0].name, true);
  } else {
    console.warn("No songs found in any folder");
  }

  await displayAlbums();

  // Play/Pause Button
  play.addEventListener("click", () => {
    if (currentSong.paused) {
      currentSong.play();
      play.src = "img/pause.svg";
    } else {
      currentSong.pause();
      play.src = "img/play.svg";
    }
  });

  // Seekbar
  let isDragging = false;
  const seekbar = document.querySelector(".seekbar");
  const circle = document.querySelector(".circle");
  let lastUpdateTime = 0;
  const throttleDelay = 50;

  currentSong.addEventListener("timeupdate", () => {
    if (!isDragging) {
      document.querySelector(".songtime").innerHTML =
        `${secondsToMinutesSeconds(currentSong.currentTime)} / ${secondsToMinutesSeconds(currentSong.duration)}`;
      document.querySelector(".circle").style.left =
        (currentSong.currentTime / currentSong.duration) * 100 + "%";
    }
  });

  seekbar.addEventListener("mousedown", (e) => {
    isDragging = true;
    updateSeekbar(e);
  });

  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      const now = Date.now();
      if (now - lastUpdateTime >= throttleDelay) {
        updateSeekbar(e);
        lastUpdateTime = now;
      }
    }
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) isDragging = false;
  });

  function updateSeekbar(e) {
    const rect = seekbar.getBoundingClientRect();
    let percent = ((e.clientX - rect.left) / rect.width) * 100;
    percent = Math.max(0, Math.min(100, percent));
    circle.style.left = percent + "%";
    if (!isNaN(currentSong.duration)) {
      currentSong.currentTime = (currentSong.duration * percent) / 100;
      document.querySelector(".songtime").innerHTML =
        `${secondsToMinutesSeconds(currentSong.currentTime)} / ${secondsToMinutesSeconds(currentSong.duration)}`;
    }
  }

  // Volume Control
  const volumeInput = document
    .querySelector(".range")
    .getElementsByTagName("input")[0];
  let isVolumeDragging = false;

  volumeInput.addEventListener("mousedown", () => {
    isVolumeDragging = true;
  });

  document.addEventListener("mousemove", (e) => {
    if (isVolumeDragging) {
      const rect = volumeInput.getBoundingClientRect();
      let percent = ((e.clientX - rect.left) / rect.width) * 100;
      percent = Math.max(0, Math.min(100, percent));
      volumeInput.value = percent;
      currentSong.volume = percent / 100;
      if (currentSong.volume > 0) {
        document.querySelector(".volume>img").src = document
          .querySelector(".volume>img")
          .src.replace("mute.svg", "volume.svg");
      }
    }
  });

  document.addEventListener("mouseup", () => {
    isVolumeDragging = false;
  });

  volumeInput.addEventListener("change", (e) => {
    currentSong.volume = parseInt(e.target.value) / 100;
    if (currentSong.volume > 0) {
      document.querySelector(".volume>img").src = document
        .querySelector(".volume>img")
        .src.replace("mute.svg", "volume.svg");
    }
  });

  // Hamburger Menu
  document.querySelector(".hamburger").addEventListener("click", () => {
    document.querySelector(".left").style.left = "0";
  });

  document.querySelector(".close").addEventListener("click", () => {
    document.querySelector(".left").style.left = "-120%";
  });

  // Previous Button
  previous.addEventListener("click", () => {
    currentSong.pause();
    const currentTrack = decodeURI(currentSong.src.split("/").pop());
    const index = songs.findIndex((s) => decodeURI(s.name) === currentTrack);
    if (index - 1 >= 0) {
      playMusic(songs[index - 1].name);
      currFolder = songs[index - 1].folder;
    }
  });

  // Next Button
  next.addEventListener("click", () => {
    currentSong.pause();
    const currentTrack = decodeURI(currentSong.src.split("/").pop());
    const index = songs.findIndex((s) => decodeURI(s.name) === currentTrack);
    if (index + 1 < songs.length) {
      playMusic(songs[index + 1].name);
      currFolder = songs[index + 1].folder;
    }
  });

  // Volume Mute/Unmute
  document.querySelector(".volume>img").addEventListener("click", (e) => {
    if (e.target.src.includes("volume.svg")) {
      e.target.src = e.target.src.replace("volume.svg", "mute.svg");
      currentSong.volume = 0;
      document.querySelector(".range").getElementsByTagName("input")[0].value =
        0;
    } else {
      e.target.src = e.target.src.replace("mute.svg", "volume.svg");
      currentSong.volume = 0.1;
      document.querySelector(".range").getElementsByTagName("input")[0].value =
        10;
    }
  });
}

main();
