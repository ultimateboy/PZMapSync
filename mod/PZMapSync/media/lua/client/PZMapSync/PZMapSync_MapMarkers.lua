require "PZMapSync/PZMapSync_Config"

PZMapSync = PZMapSync or {}

local MapMarkers = {
    lastProbeAt = 0,
    lastProbe = {
        available = false,
        reason = "not probed",
        symbols = {}
    }
}

local function callString(target, methodName)
    if not target or not target[methodName] then
        return nil
    end

    local ok, value = pcall(function()
        return target[methodName](target)
    end)

    if ok and value ~= nil then
        return tostring(value)
    end

    return nil
end

local function callNumber(target, methodName)
    if not target or not target[methodName] then
        return nil
    end

    local ok, value = pcall(function()
        return target[methodName](target)
    end)

    if ok and value ~= nil then
        return tonumber(value)
    end

    return nil
end

local function inspectSymbol(symbol, index)
    local kind = callString(symbol, "getType") or callString(symbol, "type") or "unknown"

    return {
        index = index,
        type = kind,
        symbolId = callString(symbol, "getSymbolID"),
        text = callString(symbol, "getUntranslatedText") or callString(symbol, "getTranslatedText"),
        x = callNumber(symbol, "getX"),
        y = callNumber(symbol, "getY"),
        z = callNumber(symbol, "getZ")
    }
end

function MapMarkers.probe(nowMs)
    if not PZMapSync.Config.IncludeMarkerProbe then
        return MapMarkers.lastProbe
    end

    if nowMs - MapMarkers.lastProbeAt < PZMapSync.Config.MarkerProbeIntervalMs then
        return MapMarkers.lastProbe
    end

    MapMarkers.lastProbeAt = nowMs

    if not MapItem or not MapItem.getSingleton then
        MapMarkers.lastProbe = {
            available = false,
            reason = "MapItem.getSingleton is unavailable",
            symbols = {}
        }
        return MapMarkers.lastProbe
    end

    local okMapItem, mapItem = pcall(function()
        return MapItem.getSingleton()
    end)

    if not okMapItem or not mapItem or not mapItem.getSymbols then
        MapMarkers.lastProbe = {
            available = false,
            reason = "MapItem singleton or getSymbols is unavailable",
            symbols = {}
        }
        return MapMarkers.lastProbe
    end

    local okSymbols, symbols = pcall(function()
        return mapItem:getSymbols()
    end)

    if not okSymbols or not symbols then
        MapMarkers.lastProbe = {
            available = false,
            reason = "mapItem:getSymbols failed",
            symbols = {}
        }
        return MapMarkers.lastProbe
    end

    local count = callNumber(symbols, "getSymbolCount") or 0
    local modificationCount = callNumber(symbols, "getModificationCount")
    local inspected = {}
    local inspectCount = math.min(count, 25)

    for index = 0, inspectCount - 1 do
        local okSymbol, symbol = pcall(function()
            return symbols:getSymbolByIndex(index)
        end)

        if okSymbol and symbol then
            inspected[#inspected + 1] = inspectSymbol(symbol, index)
        end
    end

    MapMarkers.lastProbe = {
        available = true,
        reason = nil,
        symbolCount = count,
        modificationCount = modificationCount,
        symbols = inspected
    }

    return MapMarkers.lastProbe
end

PZMapSync.MapMarkers = MapMarkers
