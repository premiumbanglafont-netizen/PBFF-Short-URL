
// PBFF Short URL Generator
const API_BASE = "https://pbff.pbff.workers.dev";

const $ = (id) => document.getElementById(id);

const form = $("shortenForm");
const longUrl = $("longUrl");
const customCode = $("customCode");
const createBtn = $("createBtn");
const message = $("message");
const result = $("result");
const shortUrlElement = $("shortUrl");
const qrcodeElement = $("qrcode");
const linksBody = $("linksBody");

let latestShortUrl = "";
let latestLinks = [];

$("domainPreview").textContent = new URL(API_BASE).host + "/";

function showMessage(text, type = "") {
  message.textContent = text;
  message.className = "message " + type;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatDate(value) {
  if (!value) return "N/A";
  const date = new Date(String(value).replace(" ", "T") + "Z");
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

async function api(path, options = {}) {
  const response = await fetch(API_BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

function displayResult(data) {
  latestShortUrl = data.short_url;

  result.classList.remove("hidden");
  shortUrlElement.href = latestShortUrl;
  shortUrlElement.textContent = latestShortUrl;
  qrcodeElement.replaceChildren();

  if (typeof QRCode !== "undefined") {
    new QRCode(qrcodeElement, {
      text: latestShortUrl,
      width: 180,
      height: 180,
      correctLevel: QRCode.CorrectLevel.H
    });
  } else {
    qrcodeElement.textContent = "QR Code library load হয়নি।";
  }

  result.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  createBtn.disabled = true;
  createBtn.textContent = "Creating...";
  showMessage("");
  result.classList.add("hidden");

  try {
    const data = await api("/api/shorten", {
      method: "POST",
      body: JSON.stringify({
        url: longUrl.value.trim(),
        customCode: customCode.value.trim()
      })
    });

    displayResult(data);
    showMessage("PBFF Short Link সফলভাবে তৈরি হয়েছে।", "success");

    longUrl.value = "";
    customCode.value = "";
    await loadLinks();
  } catch (error) {
    showMessage(error.message || "লিংক তৈরি করা যায়নি।", "error");
  } finally {
    createBtn.disabled = false;
    createBtn.textContent = "Shorten URL";
  }
});

$("copyBtn").addEventListener("click", async () => {
  if (!latestShortUrl) return;

  try {
    await navigator.clipboard.writeText(latestShortUrl);
    showMessage("Short Link কপি হয়েছে।", "success");
  } catch {
    showMessage("কপি করা যায়নি। লিংকটি নির্বাচন করে কপি করুন।", "error");
  }
});

$("shareBtn").addEventListener("click", async () => {
  if (!latestShortUrl) return;

  try {
    if (navigator.share) {
      await navigator.share({
        title: "PBFF Short Link",
        url: latestShortUrl
      });
    } else {
      await navigator.clipboard.writeText(latestShortUrl);
      showMessage("লিংক কপি করা হয়েছে।", "success");
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      showMessage("লিংক Share করা যায়নি।", "error");
    }
  }
});

$("downloadQrBtn").addEventListener("click", () => {
  const canvas = qrcodeElement.querySelector("canvas");
  const image = qrcodeElement.querySelector("img");
  const source = canvas ? canvas.toDataURL("image/png") : image?.src;

  if (!source) {
    showMessage("প্রথমে একটি Short Link তৈরি করুন।", "error");
    return;
  }

  const link = document.createElement("a");
  link.href = source;
  link.download = "PBFF-QR-Code.png";
  link.click();
});

function renderLinks(links) {
  latestLinks = links;

  $("totalLinks").textContent = links.length.toLocaleString();
  $("totalClicks").textContent = links.reduce(
    (sum, item) => sum + Number(item.clicks || 0), 0
  ).toLocaleString();

  if (!links.length) {
    linksBody.innerHTML =
      '<tr><td colspan="5" class="empty">এখনো কোনো লিংক তৈরি হয়নি।</td></tr>';
    return;
  }

  linksBody.innerHTML = links.map((item) => `
    <tr>
      <td>
        <a href="${escapeHtml(item.short_url)}"
           target="_blank" rel="noopener noreferrer">
          ${escapeHtml(item.short_url)}
        </a>
      </td>
      <td class="original">${escapeHtml(item.original_url)}</td>
      <td>${Number(item.clicks || 0).toLocaleString()}</td>
      <td>${escapeHtml(formatDate(item.created_at))}</td>
      <td class="link-actions">
        <button class="secondary copy-link"
          type="button"
          data-url="${escapeHtml(item.short_url)}">
          Copy
        </button>
        <a class="secondary open-link"
          href="${escapeHtml(item.short_url)}"
          target="_blank" rel="noopener noreferrer">
          Open
        </a>
        <button class="delete-link"
          type="button"
          data-code="${escapeHtml(item.code)}">
          Delete
        </button>
      </td>
    </tr>
  `).join("");
}

async function loadLinks() {
  linksBody.innerHTML =
    '<tr><td colspan="5" class="empty">লিংক লোড হচ্ছে...</td></tr>';

  try {
    const data = await api("/api/links");
    renderLinks(data.links || []);
  } catch (error) {
    linksBody.innerHTML =
      `<tr><td colspan="5" class="empty">${escapeHtml(error.message)} Worker URL ও Deployment পরীক্ষা করুন।</td></tr>`;
  }
}

linksBody.addEventListener("click", async (event) => {
  const copyButton = event.target.closest(".copy-link");
  const deleteButton = event.target.closest(".delete-link");

  if (copyButton) {
    try {
      await navigator.clipboard.writeText(copyButton.dataset.url);
      copyButton.textContent = "Copied!";
      setTimeout(() => {
        copyButton.textContent = "Copy";
      }, 1500);
    } catch {
      showMessage("কপি করা যায়নি।", "error");
    }
    return;
  }

  if (deleteButton) {
    const code = deleteButton.dataset.code;

    if (!code) {
      showMessage("লিংকের কোড পাওয়া যায়নি।", "error");
      return;
    }

    const confirmed = confirm(
      `আপনি কি "${code}" Short Link-টি স্থায়ীভাবে মুছে ফেলতে চান?`
    );

    if (!confirmed) return;

    deleteButton.disabled = true;
    deleteButton.textContent = "Deleting...";

    try {
      await api(`/api/links/${encodeURIComponent(code)}`, {
        method: "DELETE"
      });

      showMessage("Short Link মুছে ফেলা হয়েছে।", "success");
      await loadLinks();
    } catch (error) {
      showMessage(error.message || "লিংক মুছতে সমস্যা হয়েছে।", "error");
      deleteButton.disabled = false;
      deleteButton.textContent = "Delete";
    }
  }
});

$("refreshBtn").addEventListener("click", loadLinks);

$("exportBtn").addEventListener("click", () => {
  if (!latestLinks.length) {
    showMessage("Export করার মতো কোনো লিংক নেই।", "error");
    return;
  }

  const rows = [
    ["Short URL", "Original URL", "Clicks", "Created At"],
    ...latestLinks.map((item) => [
      item.short_url,
      item.original_url,
      item.clicks,
      item.created_at
    ])
  ];

  const csv = rows.map((row) =>
    row.map((value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`
    ).join(",")
  ).join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = "PBFF-Short-Links.csv";
  link.click();
  URL.revokeObjectURL(downloadUrl);
});

loadLinks();
