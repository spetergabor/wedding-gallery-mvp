local LrDialogs = import "LrDialogs"
local LrFileUtils = import "LrFileUtils"
local LrPathUtils = import "LrPathUtils"
local LrPrefs = import "LrPrefs"
local LrTasks = import "LrTasks"
local LrView = import "LrView"

local SpetlyApi = require "SpetlyApi"

local prefs = LrPrefs.prefsForPlugin()
local exportServiceProvider = {}

local DEFAULT_BASE_URL = "https://spetly.app"
local PLUGIN_VERSION = "0.1.5"

local function trimTrailingSlash(value)
  return tostring(value or ""):gsub("/+$", "")
end

local function endpoint(baseUrl, path)
  return trimTrailingSlash(baseUrl ~= "" and baseUrl or DEFAULT_BASE_URL) .. path
end

local function normalizeToken(token)
  return tostring(token or ""):match("^%s*(.-)%s*$") or ""
end

local function fileSize(path)
  local attributes = LrFileUtils.fileAttributes(path)

  if attributes and attributes.fileSize then
    return attributes.fileSize
  end

  return 0
end

local function extension(path)
  return string.lower(LrPathUtils.extension(path) or "")
end

local function contentTypeForPath(path)
  local ext = extension(path)

  if ext == "jpg" or ext == "jpeg" then
    return "image/jpeg"
  end

  if ext == "png" then
    return "image/png"
  end

  if ext == "tif" or ext == "tiff" then
    return "image/tiff"
  end

  if ext == "mp4" then
    return "video/mp4"
  end

  if ext == "mov" then
    return "video/quicktime"
  end

  return "application/octet-stream"
end

local function mediaTypeForPath(path)
  local mimeType = contentTypeForPath(path)

  if string.sub(mimeType, 1, 6) == "video/" then
    return "video"
  end

  return "image"
end

local function buildFilePayload(rendition, path, index)
  local clientId = rendition.photo.localIdentifier or ("lightroom-" .. tostring(index))

  return {
    clientId = tostring(clientId),
    filename = LrPathUtils.leafName(path),
    contentType = contentTypeForPath(path),
    mediaType = mediaTypeForPath(path),
    fileSize = fileSize(path),
    capturedAt = nil,
    originalIndex = index - 1,
  }
end

local function testConnection(propertyTable)
  local token = normalizeToken(propertyTable.spetlyToken)

  if token == "" then
    LrDialogs.message("Spetly " .. PLUGIN_VERSION, "Add the gallery Lightroom token first.", "warning")
    return
  end

  local data, errorMessage = SpetlyApi.postJson(
    endpoint(propertyTable.spetlyBaseUrl, "/api/lightroom/upload-target"),
    token,
    {}
  )

  if errorMessage then
    LrDialogs.message("Spetly connection failed " .. PLUGIN_VERSION, errorMessage, "critical")
    return
  end

  local target = data.target or {}
  LrDialogs.message(
    "Spetly connection OK " .. PLUGIN_VERSION,
    "Connected to gallery: " .. tostring(target.title or target.slug or target.galleryId),
    "info"
  )
end

function exportServiceProvider.startDialog(propertyTable)
  propertyTable.spetlyBaseUrl = prefs.spetlyBaseUrl or DEFAULT_BASE_URL
  propertyTable.spetlyToken = prefs.spetlyToken or ""
  propertyTable.spetlyDuplicateMode = prefs.spetlyDuplicateMode or "skip"
end

function exportServiceProvider.endDialog(propertyTable, why)
  if why == "ok" then
    prefs.spetlyBaseUrl = propertyTable.spetlyBaseUrl
    prefs.spetlyToken = propertyTable.spetlyToken
    prefs.spetlyDuplicateMode = propertyTable.spetlyDuplicateMode
  end
end

exportServiceProvider.exportPresetFields = {
  { key = "spetlyBaseUrl", default = DEFAULT_BASE_URL },
  { key = "spetlyToken", default = "" },
  { key = "spetlyDuplicateMode", default = "skip" },
}

exportServiceProvider.showSections = {
  "fileNaming",
  "imageSettings",
  "outputSharpening",
  "metadata",
  "watermarking",
}

function exportServiceProvider.sectionsForTopOfDialog(viewFactory, propertyTable)
  local bind = LrView.bind
  local f = viewFactory

  return {
    {
      title = "Spetly target",
      f:row {
        spacing = f:control_spacing(),
        f:static_text {
          title = "Base URL",
          width = LrView.share "labelWidth",
        },
        f:edit_field {
          value = bind "spetlyBaseUrl",
          width_in_chars = 48,
        },
      },
      f:row {
        spacing = f:control_spacing(),
        f:static_text {
          title = "Gallery token",
          width = LrView.share "labelWidth",
        },
        f:edit_field {
          value = bind "spetlyToken",
          width_in_chars = 48,
        },
      },
      f:row {
        spacing = f:control_spacing(),
        f:static_text {
          title = "Duplicates",
          width = LrView.share "labelWidth",
        },
        f:popup_menu {
          value = bind "spetlyDuplicateMode",
          items = {
            { title = "Skip existing files", value = "skip" },
            { title = "Replace existing files", value = "replace" },
          },
        },
        f:push_button {
          title = "Test connection",
          action = function()
            LrTasks.startAsyncTask(function()
              testConnection(propertyTable)
            end)
          end,
        },
      },
    },
  }
end

function exportServiceProvider.processRenderedPhotos(functionContext, exportContext)
  local exportSession = exportContext.exportSession
  local exportSettings = exportContext.propertyTable
  local token = normalizeToken(exportSettings.spetlyToken)
  local baseUrl = trimTrailingSlash(exportSettings.spetlyBaseUrl)
  local duplicateMode = exportSettings.spetlyDuplicateMode or "skip"
  local renditionCount = exportSession:countRenditions()
  local progressScope = exportContext:configureProgress {
    title = renditionCount > 1 and "Uploading to Spetly" or "Uploading photo to Spetly",
  }
  local rendered = {}
  local files = {}
  local index = 1

  if token == "" then
    LrDialogs.message("Spetly " .. PLUGIN_VERSION, "Missing gallery Lightroom token.", "critical")
    return
  end

  for _, rendition in exportContext:renditions { stopIfCanceled = true } do
    local success, pathOrMessage = rendition:waitForRender()

    if success then
      local path = pathOrMessage
      local filePayload = buildFilePayload(rendition, path, index)

      rendered[filePayload.clientId] = {
        path = path,
        rendition = rendition,
        contentType = filePayload.contentType,
      }
      files[#files + 1] = filePayload
      index = index + 1
    else
      rendition:uploadFailed(pathOrMessage)
    end
  end

  if #files == 0 then
    return
  end

  progressScope:setCaption("Preparing Spetly upload session...")
  local sessionData, sessionError = SpetlyApi.postJson(
    endpoint(baseUrl, "/api/lightroom/uploads"),
    token,
    {
      files = files,
      duplicateMode = duplicateMode,
    },
    120
  )

  if sessionError then
    LrDialogs.message("Spetly upload failed " .. PLUGIN_VERSION, sessionError, "critical")
    return
  end

  local completedUploads = {}
  local failedUploads = {}
  local uploads = sessionData.uploads or {}

  for uploadIndex, upload in ipairs(uploads) do
    progressScope:setPortionComplete(uploadIndex - 1, #uploads)
    progressScope:setCaption("Uploading " .. tostring(upload.filename or uploadIndex) .. " to Spetly...")

    local renderedFile = rendered[upload.clientId]

    if upload.alreadyCompleted then
      completedUploads[#completedUploads + 1] = {
        uploadItemId = upload.uploadItemId,
        replacePhotoId = upload.replacePhotoId,
      }
    elseif renderedFile and upload.uploadUrl and upload.uploadUrl ~= "" then
      local ok, uploadError = SpetlyApi.putFile(upload.uploadUrl, renderedFile.path, renderedFile.contentType)

      if ok then
        completedUploads[#completedUploads + 1] = {
          uploadItemId = upload.uploadItemId,
          replacePhotoId = upload.replacePhotoId,
        }
      else
        failedUploads[#failedUploads + 1] = tostring(upload.filename or uploadIndex) .. ": " .. tostring(uploadError)
        renderedFile.rendition:uploadFailed(uploadError)
      end
    else
      failedUploads[#failedUploads + 1] = tostring(upload.filename or uploadIndex) .. ": missing rendered file or upload URL"
    end
  end

  if #completedUploads == 0 then
    local detail = ""

    if #failedUploads > 0 then
      detail = "\n\nFirst error: " .. failedUploads[1]
    end

    LrDialogs.message(
      "Spetly upload stopped " .. PLUGIN_VERSION,
      "No file reached Spetly. The upload session was created, but every rendered file failed before completion. Check the Lightroom export settings and network connection, then try one photo again." .. detail,
      "critical"
    )
    return
  end

  progressScope:setPortionComplete(1, 1)
  progressScope:setCaption("Completing Spetly upload...")

  local completeData, completeError = SpetlyApi.postJson(
    endpoint(baseUrl, "/api/lightroom/uploads/complete"),
    token,
    {
      sessionId = sessionData.sessionId,
      uploads = completedUploads,
    },
    120
  )

  if completeError then
    LrDialogs.message("Spetly completion failed " .. PLUGIN_VERSION, completeError, "critical")
    return
  end

  LrDialogs.message(
    "Spetly upload complete " .. PLUGIN_VERSION,
    "Created " .. tostring(completeData.createdCount or 0) .. " photos, replaced " .. tostring(completeData.replacedCount or 0) .. ".",
    "info"
  )
end

return exportServiceProvider
