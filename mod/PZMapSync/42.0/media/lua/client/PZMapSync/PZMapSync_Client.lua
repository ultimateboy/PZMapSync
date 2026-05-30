require "PZMapSync/PZMapSync_Config"
require "PZMapSync/PZMapSync_Writer"
require "PZMapSync/PZMapSync_MapMarkers"

PZMapSync = PZMapSync or {}

local Client = {
    lastWriteAt = 0,
    sequence = 0,
    wroteFirstSnapshot = false
}

local function log(message)
    print(PZMapSync.Config.LogPrefix .. " " .. message)
end

local function nowMs()
    if getTimestampMs then
        local ok, value = pcall(getTimestampMs)
        if ok and value then
            return tonumber(value)
        end
    end

    return os.time() * 1000
end

local function callValue(target, methodName)
    if not target or not target[methodName] then
        return nil
    end

    local ok, value = pcall(function()
        return target[methodName](target)
    end)

    if ok then
        return value
    end

    return nil
end

local function directionOf(player)
    local direction = callValue(player, "getDir")
    if direction ~= nil then
        return tostring(direction)
    end
    return nil
end

local function nameOf(player)
    local username = callValue(player, "getUsername")
    if username and username ~= "" then
        return tostring(username)
    end

    local displayName = callValue(player, "getDisplayName")
    if displayName and displayName ~= "" then
        return tostring(displayName)
    end

    return "Player"
end

local function saveName()
    if getWorld and getWorld() and getWorld().getWorld then
        local ok, value = pcall(function()
            return getWorld():getWorld()
        end)
        if ok and value then
            return tostring(value)
        end
    end

    if getGameTime and getGameTime() and getGameTime().getWorldAgeHours then
        local ok, value = pcall(function()
            return getGameTime():getWorldAgeHours()
        end)
        if ok and value then
            return "world-age-" .. tostring(math.floor(value))
        end
    end

    return nil
end

local function buildPlayer(player)
    return {
        id = "local-0",
        name = nameOf(player),
        x = callValue(player, "getX"),
        y = callValue(player, "getY"),
        z = callValue(player, "getZ"),
        direction = directionOf(player)
    }
end

local function buildSnapshot(player, timestampMs)
    Client.sequence = Client.sequence + 1

    return {
        schemaVersion = PZMapSync.Config.SchemaVersion,
        sequence = Client.sequence,
        game = {
            build = getCore and tostring(getCore():getVersion()) or nil,
            world = saveName()
        },
        writtenAt = timestampMs,
        players = {
            buildPlayer(player)
        },
        markers = {},
        markerProbe = PZMapSync.MapMarkers.probe(timestampMs)
    }
end

function Client.onPlayerUpdate(player)
    if not player then
        return
    end

    local timestampMs = nowMs()
    if timestampMs - Client.lastWriteAt < PZMapSync.Config.WriteIntervalMs then
        return
    end

    Client.lastWriteAt = timestampMs
    local snapshot = buildSnapshot(player, timestampMs)

    if PZMapSync.Writer.writeSnapshot(snapshot) and not Client.wroteFirstSnapshot then
        Client.wroteFirstSnapshot = true
        log("Writing snapshots to " .. PZMapSync.Config.OutputFile)
    end
end

Events.OnPlayerUpdate.Add(Client.onPlayerUpdate)

PZMapSync.Client = Client
